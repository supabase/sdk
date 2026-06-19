import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import { extractFromSource, parseDartProject } from "../src/dart-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "dart-sample");

function names(src: string): string[] {
  return extractFromSource(src, "lib/client.dart").map((s) => s.name);
}

describe("extractFromSource — class declarations", () => {
  it("extracts a public class", () => {
    expect(names("class SupabaseClient {\n}")).toContain("SupabaseClient");
  });

  it("extracts an abstract class", () => {
    expect(names("abstract class AuthBase {\n}")).toContain("AuthBase");
  });

  it("extracts a final class", () => {
    expect(names("final class StorageClient {\n}")).toContain("StorageClient");
  });

  it("extracts an enum", () => {
    expect(names("enum AuthChangeEvent {\n  signedIn,\n}")).toContain("AuthChangeEvent");
  });

  it("extracts a mixin", () => {
    expect(names("mixin LoggingMixin {\n}")).toContain("LoggingMixin");
  });

  it("extracts a mixin class", () => {
    expect(names("mixin class ObservableMixin {\n}")).toContain("ObservableMixin");
  });

  it("does not extract a private class", () => {
    expect(names("class _InternalHelper {\n  void foo() {}\n}")).not.toContain("_InternalHelper");
  });

  it("does not extract private members of non-private class", () => {
    expect(names("class _InternalHelper {\n  void foo() {}\n}")).not.toContain(
      "_InternalHelper.foo",
    );
  });
});

describe("extractFromSource — getters and setters", () => {
  const src = `
class SupabaseClient {
  GoTrueClient get auth => _auth;
  StorageClient get storage => _storage;
  set accessToken(String value) {}
  GoTrueClient get _private => _auth;
  set _hiddenProp(String v) {}
}
`;
  it("extracts public getter", () => expect(names(src)).toContain("SupabaseClient.auth"));
  it("extracts another public getter", () => expect(names(src)).toContain("SupabaseClient.storage"));
  it("extracts setter", () => expect(names(src)).toContain("SupabaseClient.accessToken"));
  it("excludes private getter", () =>
    expect(names(src)).not.toContain("SupabaseClient._private"));
  it("excludes private setter", () =>
    expect(names(src)).not.toContain("SupabaseClient._hiddenProp"));
});

describe("extractFromSource — methods and constructors", () => {
  const src = `
class SupabaseClient {
  SupabaseClient(String url, String key) {}
  Future<void> initialize() async {}
  PostgrestBuilder from(String table) {}
  static SupabaseClient create(String url) {}
  void _privateMethod() {}
  factory SupabaseClient.withDefaults() {}
  factory SupabaseClient._internalFactory() {}
}
`;
  it("extracts constructor", () =>
    expect(names(src)).toContain("SupabaseClient.SupabaseClient"));
  it("extracts async method", () =>
    expect(names(src)).toContain("SupabaseClient.initialize"));
  it("extracts regular method", () => expect(names(src)).toContain("SupabaseClient.from"));
  it("extracts static method", () => expect(names(src)).toContain("SupabaseClient.create"));
  it("excludes private method", () =>
    expect(names(src)).not.toContain("SupabaseClient._privateMethod"));
  it("extracts public factory constructor", () =>
    expect(names(src)).toContain("SupabaseClient.withDefaults"));
  it("excludes private factory constructor", () =>
    expect(names(src)).not.toContain("SupabaseClient._internalFactory"));
});

describe("extractFromSource — named extensions", () => {
  const src = `
extension SupabaseClientExtension on SupabaseClient {
  void extraMethod() {}
  void _internalHelper() {}
}
`;
  it("extracts members of named extension", () =>
    expect(names(src)).toContain("SupabaseClientExtension.extraMethod"));
  it("excludes private members of extension", () =>
    expect(names(src)).not.toContain("SupabaseClientExtension._internalHelper"));
});

describe("extractFromSource — depth gating", () => {
  it("does not extract method calls inside method bodies", () => {
    const src = `
class SupabaseClient {
  void signIn() {
    _auth.signIn();
    sendRequest();
  }
  void signOut() {}
}
`;
    const n = names(src);
    expect(n).toContain("SupabaseClient.signIn");
    expect(n).toContain("SupabaseClient.signOut");
    expect(n).not.toContain("SupabaseClient.sendRequest");
  });

  it("does not bleed context across sibling classes", () => {
    const src = `
class Auth {
  void signIn() {}
}
class Storage {
  void upload() {}
}
`;
    const n = names(src);
    expect(n).toContain("Auth.signIn");
    expect(n).toContain("Storage.upload");
    expect(n).not.toContain("Auth.upload");
    expect(n).not.toContain("Storage.signIn");
  });
});

describe("extractFromSource — comment stripping", () => {
  it("ignores symbols in line comments", () => {
    const src = `
class Foo {
  // void notReal() {}
  void real() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.real");
    expect(n).not.toContain("Foo.notReal");
  });

  it("ignores doc comment lines", () => {
    const src = `
class Foo {
  /// void docComment() {}
  void real() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.real");
    expect(n).not.toContain("Foo.docComment");
  });
});

describe("extractFromSource — field initializers not emitted as methods", () => {
  it("does not extract field with initializer as a method", () => {
    const src = `
class Foo {
  final GoTrueClient auth = GoTrueClient();
  void signIn() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.signIn");
    expect(n).not.toContain("Foo.GoTrueClient");
    expect(n).not.toContain("Foo.auth");
  });
});

describe("extractFromSource — annotation lines do not produce false symbols", () => {
  it("ignores a parameterised @Annotation(...) on its own line", () => {
    const src = `
class RealtimeClientOptions {
  @Deprecated(
      'Client side rate limit has been removed.')
  final int? eventsPerSecond = null;
  void configure() {}
}
`;
    const n = names(src);
    expect(n).toContain("RealtimeClientOptions.configure");
    expect(n).not.toContain("RealtimeClientOptions.Deprecated");
    expect(n).not.toContain("RealtimeClientOptions.eventsPerSecond");
  });

  it("does not suppress the real declaration following an annotation", () => {
    const src = `
class Foo {
  @override
  String toString() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.toString");
  });
});

describe("extractFromSource — multi-line arrow functions do not produce false symbols", () => {
  it("extracts the method but not its continuation lines", () => {
    const src = `
class Foo {
  @override
  String toString() =>
      'Foo(value: \$value)';
  void other() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.toString");
    expect(n).toContain("Foo.other");
    expect(n).not.toContain("Foo.Foo");
  });

  it("handles multi-line arrow body containing a constructor call", () => {
    const src = `
class RemoveSubscriptionResult {
  RemoveSubscriptionResult(this.count);
  @override
  String toString() =>
      'RemoveSubscriptionResult(count: \$count)';
}
`;
    const n = names(src);
    // RemoveSubscriptionResult should appear exactly once (the real constructor)
    expect(n.filter((x) => x === "RemoveSubscriptionResult.RemoveSubscriptionResult").length).toBe(1);
  });
});

describe("extractFromSource — top-level typedef", () => {
  it("extracts a public typedef", () => {
    const n = names("typedef AuthCallback = void Function(String event);");
    expect(n).toContain("AuthCallback");
  });

  it("does not extract a private typedef", () => {
    const n = names("typedef _InternalCallback = void Function();");
    expect(n).not.toContain("_InternalCallback");
  });
});

describe("extractFromSource — generated files not scanned", () => {
  it("skips .g.dart files when scanning a project", () => {
    const dir = join(tmpdir(), `dart-parser-gen-test-${process.pid}`);
    const libDir = join(dir, "lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, "client.dart"), "class SupabaseClient {}\n");
    writeFileSync(join(libDir, "client.g.dart"), "class GeneratedClient {}\n");
    const result = parseDartProject(dir);
    const n = result.symbols.map((s) => s.name);
    expect(n).toContain("SupabaseClient");
    expect(n).not.toContain("GeneratedClient");
  });
});

describe("parseDartProject — lib/ directory convention", () => {
  it("scans lib/ when present and ignores files outside it", () => {
    const dir = join(tmpdir(), `dart-parser-lib-test-${process.pid}`);
    const libDir = join(dir, "lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, "client.dart"), "class PublicClient {}\n");
    mkdirSync(join(dir, "bin"), { recursive: true });
    writeFileSync(join(dir, "bin", "main.dart"), "class BinClass {}\n");
    const result = parseDartProject(dir);
    const n = result.symbols.map((s) => s.name);
    expect(n).toContain("PublicClient");
    expect(n).not.toContain("BinClass");
  });

  it("falls back to scanning root when lib/ is absent", () => {
    const dir = join(tmpdir(), `dart-parser-nolib-test-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "client.dart"), "class RootClient {}\n");
    const result = parseDartProject(dir);
    expect(result.symbols.map((s) => s.name)).toContain("RootClient");
  });
});

describe("parseDartProject — sdk-parse-ignore", () => {
  it("excludes files matched by sdk-parse-ignore", () => {
    const dir = join(tmpdir(), `dart-parser-ignore-test-${process.pid}`);
    const libDir = join(dir, "lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, "auth.dart"), "class AuthClient {}\n");
    writeFileSync(join(dir, "sdk-parse-ignore"), "lib/auth.dart\n");
    const result = parseDartProject(dir);
    expect(result.symbols.map((s) => s.name)).not.toContain("AuthClient");
  });

  it("excludes directories matched by sdk-parse-ignore", () => {
    const dir = join(tmpdir(), `dart-parser-dirignore-test-${process.pid}`);
    const libDir = join(dir, "lib");
    const srcDir = join(libDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(libDir, "client.dart"), "class SupabaseClient {}\n");
    writeFileSync(join(srcDir, "internal.dart"), "class InternalHelper {}\n");
    writeFileSync(join(dir, "sdk-parse-ignore"), "lib/src/\n");
    const result = parseDartProject(dir);
    const n = result.symbols.map((s) => s.name);
    expect(n).toContain("SupabaseClient");
    expect(n).not.toContain("InternalHelper");
  });
});

describe("parseDartProject — fixture", () => {
  it("finds expected public symbols", () => {
    const result = parseDartProject(FIXTURE);
    const n = result.symbols.map((s) => s.name);

    expect(n).toContain("SupabaseClient");
    expect(n).toContain("SupabaseClient.SupabaseClient");
    expect(n).toContain("SupabaseClient.auth");
    expect(n).toContain("SupabaseClient.storage");
    expect(n).toContain("SupabaseClient.accessToken");
    expect(n).toContain("SupabaseClient.initialize");
    expect(n).toContain("SupabaseClient.from");
    expect(n).toContain("SupabaseClient.create");
    expect(n).toContain("SupabaseClient.dispose");
    expect(n).toContain("StorageClient");
    expect(n).toContain("StorageClient.upload");
    expect(n).toContain("LoggingMixin");
    expect(n).toContain("LoggingMixin.log");
    expect(n).toContain("AuthCallback");
  });

  it("excludes private symbols from fixture", () => {
    const result = parseDartProject(FIXTURE);
    const n = result.symbols.map((s) => s.name);

    expect(n).not.toContain("_InternalCache");
    expect(n).not.toContain("SupabaseClient._auth");
    expect(n).not.toContain("SupabaseClient._refresh");
  });
});
