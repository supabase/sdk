import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDartdoc } from "../src/normalize-dartdoc.js";
import type { DartdocUnit } from "../src/normalize-dartdoc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture: DartdocUnit[] = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "dartdoc-sample.json"), "utf8"),
);

function names(units: DartdocUnit[]): string[] {
  return normalizeDartdoc(units).symbols.map((s) => s.name);
}

function kind(units: DartdocUnit[], name: string): string | undefined {
  return normalizeDartdoc(units).symbols.find((s) => s.name === name)?.kind;
}

describe("normalizeDartdoc — top-level class-like declarations", () => {
  it("emits 'class' kind for class declarations", () => {
    expect(kind(fixture, "SupabaseClient")).toBe("class");
  });

  it("emits 'class' kind for mixin declarations", () => {
    expect(kind(fixture, "LoggingMixin")).toBe("class");
  });

  it("emits 'class' kind for enum declarations", () => {
    expect(kind(fixture, "AuthChangeEvent")).toBe("class");
  });

  it("emits 'class' kind for extension declarations", () => {
    expect(kind(fixture, "SupabaseClientExtension")).toBe("class");
  });
});

describe("normalizeDartdoc — top-level non-class declarations", () => {
  it("emits 'variable' kind for typedef declarations", () => {
    expect(kind(fixture, "AuthCallback")).toBe("variable");
  });

  it("emits 'function' kind for top-level function declarations", () => {
    expect(kind(fixture, "resolveUrl")).toBe("function");
  });
});

describe("normalizeDartdoc — constructors", () => {
  it("emits 'method' kind for default constructor as ClassName.ClassName", () => {
    expect(names(fixture)).toContain("SupabaseClient.SupabaseClient");
    expect(kind(fixture, "SupabaseClient.SupabaseClient")).toBe("method");
  });

  it("emits 'method' kind for named constructor as ClassName.ctorName", () => {
    expect(names(fixture)).toContain("SupabaseClient.withConfig");
    expect(kind(fixture, "SupabaseClient.withConfig")).toBe("method");
  });
});

describe("normalizeDartdoc — class members", () => {
  it("emits 'property' kind for getters", () => {
    expect(kind(fixture, "SupabaseClient.auth")).toBe("property");
    expect(kind(fixture, "SupabaseClient.storage")).toBe("property");
  });

  it("emits 'property' kind for setters", () => {
    expect(kind(fixture, "SupabaseClient.accessToken")).toBe("property");
  });

  it("emits 'method' kind for regular methods", () => {
    expect(kind(fixture, "SupabaseClient.initialize")).toBe("method");
    expect(kind(fixture, "SupabaseClient.from")).toBe("method");
    expect(kind(fixture, "SupabaseClient.create")).toBe("method");
    expect(kind(fixture, "SupabaseClient.dispose")).toBe("method");
  });

  it("emits members of mixin declarations", () => {
    expect(kind(fixture, "LoggingMixin.log")).toBe("method");
  });

  it("emits members of extension declarations", () => {
    expect(kind(fixture, "SupabaseClientExtension.debug")).toBe("method");
  });
});

describe("normalizeDartdoc — privacy filter", () => {
  it("skips top-level symbols whose name starts with _", () => {
    const units: DartdocUnit[] = [
      {
        source: "lib/test.dart",
        declarations: [{ kind: "class", name: "_PrivateClass" }],
      },
    ];
    expect(names(units)).not.toContain("_PrivateClass");
  });

  it("skips member symbols whose name starts with _", () => {
    const units: DartdocUnit[] = [
      {
        source: "lib/test.dart",
        declarations: [
          {
            kind: "class",
            name: "PublicClass",
            members: [
              { kind: "method", name: "_privateMethod" },
              { kind: "method", name: "publicMethod" },
            ],
          },
        ],
      },
    ];
    const n = names(units);
    expect(n).not.toContain("PublicClass._privateMethod");
    expect(n).toContain("PublicClass.publicMethod");
  });
});

describe("normalizeDartdoc — multi-unit handling", () => {
  it("flattens symbols from multiple compilation units into one list", () => {
    const twoUnits = [...fixture, ...fixture];
    const result = normalizeDartdoc(twoUnits);
    const supabaseClients = result.symbols.filter((s) => s.name === "SupabaseClient");
    expect(supabaseClients.length).toBe(2);
  });

  it("returns empty symbol list for empty input", () => {
    const result = normalizeDartdoc([]);
    expect(result.symbols).toHaveLength(0);
  });
});

describe("normalizeDartdoc — file attribution", () => {
  it("uses the source field as the file path for all symbols", () => {
    const result = normalizeDartdoc(fixture);
    const sym = result.symbols.find((s) => s.name === "SupabaseClient");
    expect(sym?.file).toBe("lib/client.dart");
  });
});
