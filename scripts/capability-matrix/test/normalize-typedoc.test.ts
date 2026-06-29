import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { normalize, mergeProjects } from "../src/normalize-typedoc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function project(...children: object[]) {
  return { kind: 1, name: "test", children };
}
function mod(name: string, ...children: object[]) {
  return { kind: 2, name, flags: {}, children };
}
function cls(name: string, file: string, ...members: object[]) {
  return { kind: 128, name, flags: {}, sources: [{ fileName: file }], children: members };
}
function iface(name: string, file: string, ...members: object[]) {
  return { kind: 256, name, flags: {}, sources: [{ fileName: file }], children: members };
}
function enumDecl(name: string, file: string, ...members: object[]) {
  return { kind: 8, name, flags: {}, sources: [{ fileName: file }], children: members };
}
function method(name: string, file: string) {
  return { kind: 2048, name, flags: {}, sources: [{ fileName: file }] };
}
function prop(name: string, file: string) {
  return { kind: 1024, name, flags: {}, sources: [{ fileName: file }] };
}
function accessor(name: string, file: string) {
  return { kind: 262144, name, flags: {}, sources: [{ fileName: file }] };
}
function ctor(file: string) {
  return { kind: 512, name: "constructor", flags: {}, sources: [{ fileName: file }] };
}
function enumMember(name: string, file: string) {
  return { kind: 16, name, flags: {}, sources: [{ fileName: file }] };
}
function fn(name: string, file: string) {
  return { kind: 64, name, flags: {}, sources: [{ fileName: file }] };
}
function variable(name: string, file: string) {
  return { kind: 32, name, flags: {}, sources: [{ fileName: file }] };
}
function typeAlias(name: string, file: string) {
  return { kind: 2097152, name, flags: {}, sources: [{ fileName: file }] };
}
function ref(name: string) {
  return { kind: 4194304, name, flags: {} };
}
function privateFlag(base: object): object {
  return { ...base, flags: { isPrivate: true } };
}
function protectedFlag(base: object): object {
  return { ...base, flags: { isProtected: true } };
}

describe("normalize — class", () => {
  it("emits class symbol", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts")));
    expect(result.symbols).toContainEqual({ name: "AuthClient", kind: "class", file: "src/auth.ts" });
  });

  it("emits class method", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts", method("signUp", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient.signUp", kind: "method", file: "src/auth.ts" });
  });

  it("emits class property", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts", prop("session", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient.session", kind: "property", file: "src/auth.ts" });
  });

  it("emits accessor as method kind", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts", accessor("token", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient.token", kind: "method", file: "src/auth.ts" });
  });

  it("skips constructor", () => {
    const result = normalize(project(cls("Foo", "src/foo.ts", ctor("src/foo.ts"), method("bar", "src/foo.ts"))));
    const names = result.symbols.map(s => s.name);
    expect(names).not.toContain("Foo.constructor");
    expect(names).toContain("Foo.bar");
  });
});

describe("normalize — interface", () => {
  it("emits interface as class kind", () => {
    const result = normalize(project(iface("Session", "src/session.ts")));
    expect(result.symbols).toContainEqual({ name: "Session", kind: "class", file: "src/session.ts" });
  });

  it("emits interface members as property", () => {
    const result = normalize(project(iface("Session", "src/session.ts", prop("user", "src/session.ts"))));
    expect(result.symbols).toContainEqual({ name: "Session.user", kind: "property", file: "src/session.ts" });
  });
});

describe("normalize — enum", () => {
  it("emits enum as class kind", () => {
    const result = normalize(project(enumDecl("UserRole", "src/role.ts")));
    expect(result.symbols).toContainEqual({ name: "UserRole", kind: "class", file: "src/role.ts" });
  });

  it("emits enum member as property kind", () => {
    const result = normalize(project(enumDecl("UserRole", "src/role.ts", enumMember("Admin", "src/role.ts"))));
    expect(result.symbols).toContainEqual({ name: "UserRole.Admin", kind: "property", file: "src/role.ts" });
  });
});

describe("normalize — top-level declarations", () => {
  it("emits exported function", () => {
    const result = normalize(project(fn("createClient", "src/index.ts")));
    expect(result.symbols).toContainEqual({ name: "createClient", kind: "function", file: "src/index.ts" });
  });

  it("emits exported variable", () => {
    const result = normalize(project(variable("VERSION", "src/index.ts")));
    expect(result.symbols).toContainEqual({ name: "VERSION", kind: "variable", file: "src/index.ts" });
  });

  it("emits type alias as variable kind", () => {
    const result = normalize(project(typeAlias("AuthResponse", "src/types.ts")));
    expect(result.symbols).toContainEqual({ name: "AuthResponse", kind: "variable", file: "src/types.ts" });
  });

  it("skips Reference kind", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts"), ref("Client")));
    const names = result.symbols.map(s => s.name);
    expect(names).not.toContain("Client");
    expect(names).toContain("AuthClient");
  });
});

describe("normalize — traversal", () => {
  it("walks into Module wrapper (kind 2)", () => {
    const result = normalize(project(mod("src/auth", cls("AuthClient", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient", kind: "class", file: "src/auth.ts" });
  });

  it("walks into Namespace wrapper (kind 4)", () => {
    const ns = { kind: 4, name: "Utils", flags: {}, children: [fn("helper", "src/utils.ts")] };
    const result = normalize(project(ns));
    expect(result.symbols).toContainEqual({ name: "helper", kind: "function", file: "src/utils.ts" });
  });

  it("captures file path from sources[0].fileName", () => {
    const result = normalize(project(fn("foo", "packages/core/src/index.ts")));
    expect(result.symbols[0]?.file).toBe("packages/core/src/index.ts");
  });
});

describe("normalize — privacy (defensive filter)", () => {
  it("skips member with isPrivate flag", () => {
    const result = normalize(project(
      cls("Foo", "src/foo.ts", privateFlag(prop("secret", "src/foo.ts")))
    ));
    expect(result.symbols.map(s => s.name)).not.toContain("Foo.secret");
  });

  it("skips member with isProtected flag", () => {
    const result = normalize(project(
      cls("Foo", "src/foo.ts", protectedFlag(prop("internal", "src/foo.ts")))
    ));
    expect(result.symbols.map(s => s.name)).not.toContain("Foo.internal");
  });
});

describe("normalize (fixture — real TypeDoc 0.27 output)", () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, "fixtures/typedoc-sample.json"), "utf8")
  );

  it("finds AuthClient class", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).toContain("AuthClient");
  });

  it("finds AuthClient.signUp method", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).toContain("AuthClient.signUp");
  });

  it("finds Session interface as class kind", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "Session");
    expect(sym?.kind).toBe("class");
  });

  it("finds UserRole enum as class kind", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "UserRole");
    expect(sym?.kind).toBe("class");
  });

  it("finds AuthResponse type alias as variable kind", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "AuthResponse");
    expect(sym?.kind).toBe("variable");
  });

  it("finds createClient function", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "createClient");
    expect(sym?.kind).toBe("function");
  });

  it("finds VERSION variable", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "VERSION");
    expect(sym?.kind).toBe("variable");
  });

  it("does not emit Client (re-export Reference)", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).not.toContain("Client");
  });

  it("does not emit constructor", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).not.toContain("AuthClient.constructor");
  });

  it("emits AuthClient.session accessor as method kind from fixture", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "AuthClient.session");
    expect(sym?.kind).toBe("method");
  });
});

describe("mergeProjects", () => {
  it("behaves like normalize for a single project (back-compat)", () => {
    const json = project(cls("AuthClient", "src/auth.ts", method("signUp", "src/auth.ts")));
    expect(mergeProjects([json])).toEqual(normalize(json));
  });

  it("concatenates symbols from multiple projects", () => {
    const a = project(cls("AuthClient", "packages/core/auth-js/src/index.ts"));
    const b = project(cls("StorageClient", "packages/core/storage-js/src/index.ts"));
    const names = mergeProjects([a, b]).symbols.map(s => s.name);
    expect(names).toContain("AuthClient");
    expect(names).toContain("StorageClient");
  });

  it("preserves each project's (repo-relative) file paths", () => {
    const a = project(cls("AuthClient", "packages/core/auth-js/src/index.ts"));
    const b = project(cls("StorageClient", "packages/core/storage-js/src/index.ts"));
    const merged = mergeProjects([a, b]);
    expect(merged.symbols.find(s => s.name === "AuthClient")?.file)
      .toBe("packages/core/auth-js/src/index.ts");
    expect(merged.symbols.find(s => s.name === "StorageClient")?.file)
      .toBe("packages/core/storage-js/src/index.ts");
  });

  it("keeps duplicate re-exported names (deduped by name downstream)", () => {
    // supabase-js re-exports FunctionsClient from functions-js, so the same
    // name legitimately appears in two projects. mergeProjects keeps both;
    // checkNewSymbols collapses them by name.
    const fns = project(cls("FunctionsClient", "packages/core/functions-js/src/index.ts"));
    const sb = project(cls("FunctionsClient", "packages/core/functions-js/dist/types.d.ts"));
    const names = mergeProjects([fns, sb]).symbols.map(s => s.name).filter(n => n === "FunctionsClient");
    expect(names).toHaveLength(2);
  });
});
