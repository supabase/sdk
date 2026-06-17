import { describe, it, expect } from "vitest";
import { extractFromSource } from "../src/swift-parser";

function names(src: string): string[] {
  return extractFromSource(src, "src/Foo.swift").map((s) => s.name);
}

describe("extractFromSource — type declarations", () => {
  it("extracts a public class", () => {
    expect(names("public class AuthClient {\n}")).toContain("AuthClient");
  });

  it("extracts a public final class", () => {
    expect(names("public final class SupabaseClient {\n}")).toContain("SupabaseClient");
  });

  it("extracts a public struct", () => {
    expect(names("public struct Session {\n}")).toContain("Session");
  });

  it("extracts a public actor", () => {
    expect(names("public actor AuthClient {\n}")).toContain("AuthClient");
  });

  it("extracts a public protocol", () => {
    expect(names("public protocol AuthStateChangeListenerRegistration {\n}")).toContain(
      "AuthStateChangeListenerRegistration",
    );
  });

  it("does not extract a non-public class", () => {
    expect(names("class Internal {\n  public func foo() {}\n}")).not.toContain("Internal");
  });
});

describe("extractFromSource — public class members", () => {
  const src = `
public class AuthClient {
  public var session: Session { get async throws {} }
  public func signUp(email: String) async throws -> Session {}
  private var _token: String?
  internal func _internal() {}
  nonisolated public var currentSession: Session?
  nonisolated public func handle(_ url: URL) {}
  public init(configuration: Configuration) {}
  public typealias EventCallback = @Sendable (AuthChangeEvent) -> Void
}
`;
  it("includes public var", () => expect(names(src)).toContain("AuthClient.session"));
  it("includes public func", () => expect(names(src)).toContain("AuthClient.signUp"));
  it("includes nonisolated public var", () => expect(names(src)).toContain("AuthClient.currentSession"));
  it("includes nonisolated public func", () => expect(names(src)).toContain("AuthClient.handle"));
  it("includes public init", () => expect(names(src)).toContain("AuthClient.init"));
  it("includes public typealias", () => expect(names(src)).toContain("AuthClient.EventCallback"));
  it("excludes private var", () => expect(names(src)).not.toContain("AuthClient._token"));
  it("excludes internal func", () => expect(names(src)).not.toContain("AuthClient._internal"));
});

describe("extractFromSource — static members", () => {
  const src = `
public class FunctionsClient {
  public static let defaultTimeout: TimeInterval = 150
  public static func create() -> FunctionsClient {}
}
`;
  it("includes public static let", () => expect(names(src)).toContain("FunctionsClient.defaultTimeout"));
  it("includes public static func", () => expect(names(src)).toContain("FunctionsClient.create"));
});

describe("extractFromSource — plain extensions", () => {
  const src = `
extension AuthClient {
  public func signOut() async throws {}
  func internalHelper() {}
}
`;
  it("includes explicitly public members in extension", () =>
    expect(names(src)).toContain("AuthClient.signOut"));
  it("excludes non-public members in extension", () =>
    expect(names(src)).not.toContain("AuthClient.internalHelper"));
});

describe("extractFromSource — dotted extension names", () => {
  const src = `
extension AuthClient.Configuration {
  public static let defaultLocalStorage: any AuthLocalStorage = KeychainLocalStorage()
}
`;
  it("handles dotted extension name", () =>
    expect(names(src)).toContain("AuthClient.Configuration.defaultLocalStorage"));
});

describe("extractFromSource — nested types", () => {
  const src = `
public class SupabaseClient {
  public struct Configuration {
    public var url: URL
  }
  public func from(_ table: String) -> PostgrestQueryBuilder {}
}
`;
  it("extracts nested struct", () => expect(names(src)).toContain("SupabaseClient.Configuration"));
  it("extracts nested struct property", () => expect(names(src)).toContain("SupabaseClient.Configuration.url"));
  it("extracts outer class method", () => expect(names(src)).toContain("SupabaseClient.from"));
});

describe("extractFromSource — multiline function signatures", () => {
  const src = `
public class AuthClient {
  public func signUp(
    email: String,
    password: String,
    captchaToken: String? = nil
  ) async throws -> Session {
    return Session()
  }
}
`;
  it("captures method whose signature spans multiple lines", () =>
    expect(names(src)).toContain("AuthClient.signUp"));
});

describe("extractFromSource — comment stripping", () => {
  it("ignores symbols in line comments", () => {
    const src = `
public class Foo {
  // public func notReal() {}
  public func real() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.real");
    expect(n).not.toContain("Foo.notReal");
  });

  it("ignores doc comment lines", () => {
    const src = `
public class Foo {
  /// public func docComment() {}
  public func real() {}
}
`;
    const n = names(src);
    expect(n).toContain("Foo.real");
    expect(n).not.toContain("Foo.docComment");
  });
});

describe("extractFromSource — context stack correctness", () => {
  it("does not bleed context across sibling types", () => {
    const src = `
public class Auth {
  public func signUp() {}
}
public class Storage {
  public func upload() {}
}
`;
    const n = names(src);
    expect(n).toContain("Auth.signUp");
    expect(n).toContain("Storage.upload");
    expect(n).not.toContain("Auth.upload");
    expect(n).not.toContain("Storage.signUp");
  });
});
