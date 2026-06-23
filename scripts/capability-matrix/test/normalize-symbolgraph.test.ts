import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSymbolGraph, type SymbolGraphSymbol } from "../src/normalize-symbolgraph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper to build a minimal SymbolGraphSymbol for inline tests.
function sym(
  identifier: string,
  accessLevel: string,
  pathComponents: string[],
  uri?: string,
): SymbolGraphSymbol {
  return {
    kind: { identifier },
    accessLevel,
    pathComponents,
    ...(uri ? { location: { uri } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Kind mapping
// ---------------------------------------------------------------------------

describe("kind mapping — types", () => {
  it("maps swift.class to 'class'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.class", "public", ["MyClass"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass", kind: "class" });
  });
  it("maps swift.struct to 'class'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.struct", "public", ["MyStruct"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyStruct", kind: "class" });
  });
  it("maps swift.enum to 'class'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.enum", "public", ["MyEnum"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyEnum", kind: "class" });
  });
  it("maps swift.protocol to 'class'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.protocol", "public", ["MyProto"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyProto", kind: "class" });
  });
  it("maps swift.actor to 'class'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.actor", "public", ["MyActor"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyActor", kind: "class" });
  });
});

describe("kind mapping — callables", () => {
  it("maps swift.func (top-level) to 'function'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.func", "public", ["globalFn()"])], "");
    expect(symbols[0]).toMatchObject({ name: "globalFn", kind: "function" });
  });
  it("maps swift.func.op to 'function'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.func.op", "public", ["==(_:_:)"])], "");
    expect(symbols[0]).toMatchObject({ name: "==", kind: "function" });
  });
  it("maps swift.method to 'method'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.method", "public", ["MyClass", "doThing()"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.doThing", kind: "method" });
  });
  it("maps swift.type.method (static) to 'method'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.type.method", "public", ["MyClass", "create()"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.create", kind: "method" });
  });
  it("maps swift.init to 'method' and strips signature", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.init", "public", ["MyClass", "init(url:key:)"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.init", kind: "method" });
  });
  it("maps swift.subscript to 'method'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.subscript", "public", ["MyClass", "subscript(_:)"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.subscript", kind: "method" });
  });
});

describe("kind mapping — properties and variables", () => {
  it("maps swift.property to 'property'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.property", "public", ["MyClass", "value"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.value", kind: "property" });
  });
  it("maps swift.type.property (static) to 'property'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.type.property", "public", ["MyClass", "shared"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.shared", kind: "property" });
  });
  it("maps swift.enum.case to 'property'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.enum.case", "public", ["MyEnum", "alpha"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyEnum.alpha", kind: "property" });
  });
  it("maps swift.typealias to 'variable'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.typealias", "public", ["MyClass", "Callback"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyClass.Callback", kind: "variable" });
  });
  it("maps swift.associatedtype to 'variable'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.associatedtype", "public", ["MyProto", "Item"])], "");
    expect(symbols[0]).toMatchObject({ name: "MyProto.Item", kind: "variable" });
  });
  it("maps swift.var (global) to 'variable'", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.var", "public", ["globalVar"])], "");
    expect(symbols[0]).toMatchObject({ name: "globalVar", kind: "variable" });
  });
});

// ---------------------------------------------------------------------------
// Skipped kinds
// ---------------------------------------------------------------------------

describe("skipped kinds", () => {
  it("skips swift.deinit", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.deinit", "public", ["MyClass", "deinit"])], "");
    expect(symbols).toHaveLength(0);
  });
  it("skips unrecognised kind identifiers", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.unknown.thing", "public", ["Something"])], "");
    expect(symbols).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Name construction
// ---------------------------------------------------------------------------

describe("name construction", () => {
  it("joins pathComponents with '.'", () => {
    const { symbols } = normalizeSymbolGraph(
      [sym("swift.method", "public", ["SupabaseClient", "signIn(email:password:)"])], ""
    );
    expect(symbols[0].name).toBe("SupabaseClient.signIn");
  });
  it("handles deeply nested types", () => {
    const { symbols } = normalizeSymbolGraph(
      [sym("swift.property", "public", ["Outer", "Inner", "value"])], ""
    );
    expect(symbols[0].name).toBe("Outer.Inner.value");
  });
  it("strips trailing function signature from last pathComponent", () => {
    const { symbols } = normalizeSymbolGraph(
      [sym("swift.method", "public", ["Auth", "signUp(email:password:captchaToken:)"])], ""
    );
    expect(symbols[0].name).toBe("Auth.signUp");
  });
  it("leaves non-function pathComponents unchanged", () => {
    const { symbols } = normalizeSymbolGraph(
      [sym("swift.property", "public", ["Auth", "session"])], ""
    );
    expect(symbols[0].name).toBe("Auth.session");
  });
});

// ---------------------------------------------------------------------------
// File path resolution
// ---------------------------------------------------------------------------

describe("file path resolution", () => {
  it("strips 'file://' prefix and makes path relative to sdkRoot", () => {
    const sdkRoot = "/home/runner/work/supabase-swift";
    const uri = `file://${sdkRoot}/Sources/Auth/AuthClient.swift`;
    const { symbols } = normalizeSymbolGraph([sym("swift.class", "public", ["Auth"], uri)], sdkRoot);
    expect(symbols[0].file).toBe("Sources/Auth/AuthClient.swift");
  });
  it("returns empty string when location is absent", () => {
    const { symbols } = normalizeSymbolGraph([sym("swift.class", "public", ["Auth"])], "/any/root");
    expect(symbols[0].file).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Multi-input
// ---------------------------------------------------------------------------

describe("multi-symbol input", () => {
  it("handles symbols from multiple modules in merged flat array", () => {
    const input: SymbolGraphSymbol[] = [
      sym("swift.class",  "public", ["ClassFromAuth"]),
      sym("swift.struct", "public", ["StructFromStorage"]),
    ];
    const { symbols } = normalizeSymbolGraph(input, "");
    const names = symbols.map(s => s.name);
    expect(names).toContain("ClassFromAuth");
    expect(names).toContain("StructFromStorage");
  });
});

// ---------------------------------------------------------------------------
// Smoke test against real fixture
// ---------------------------------------------------------------------------

describe("real fixture smoke test", () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, "fixtures/symbolgraph-sample.json"), "utf8")
  ) as SymbolGraphSymbol[];

  const { symbols } = normalizeSymbolGraph(fixture, "/sdk-root");

  it("produces a non-empty symbol list", () => {
    expect(symbols.length).toBeGreaterThan(10);
  });
  it("includes SimpleClass from fixture", () => {
    expect(symbols.map(s => s.name)).toContain("SimpleClass");
  });
  it("includes SimpleClass.instanceMethod from fixture", () => {
    expect(symbols.map(s => s.name)).toContain("SimpleClass.instanceMethod");
  });
  it("includes SimpleEnum.alpha (enum case) from fixture", () => {
    expect(symbols.map(s => s.name)).toContain("SimpleEnum.alpha");
  });
  it("includes OpenClass from fixture (open access level)", () => {
    expect(symbols.map(s => s.name)).toContain("OpenClass");
  });
  it("includes globalFunction from fixture", () => {
    expect(symbols.map(s => s.name)).toContain("globalFunction");
  });
  it("includes SimpleClass.NestedStruct (nested type) from fixture", () => {
    expect(symbols.map(s => s.name)).toContain("SimpleClass.NestedStruct");
  });
});
