import { describe, expect, test } from "bun:test";

import type { DocModule, TsType } from "../src/doc-nodes.ts";
import { normalizeContract } from "../src/normalize.ts";

const ENTRY = "file:///project/supabase/functions/fn/index.ts";
const SHARED = "file:///project/supabase/functions/_shared/types.ts";

const keyword = (value: string): TsType => ({
  kind: "keyword",
  repr: value,
  value,
});
const literal = (value: string | number | boolean): TsType => ({
  kind: "literal",
  repr: String(value),
  value:
    typeof value === "string"
      ? { kind: "string", string: value }
      : typeof value === "number"
        ? { kind: "number", number: value }
        : { kind: "boolean", boolean: value },
});
const union = (...members: TsType[]): TsType => ({
  kind: "union",
  value: members,
});
const ref = (
  typeName: string,
  resolution?: {
    kind: string;
    specifier?: string;
    name?: string;
    declaringName?: string;
    declaringKind?: string;
  },
  typeParams?: TsType[],
): TsType => ({
  kind: "typeRef",
  repr: typeName,
  value: {
    typeName,
    ...(typeParams ? { typeParams } : {}),
    ...(resolution ? { resolution } : {}),
  },
});
const objectLiteral = (
  properties: { name: string; tsType: TsType; optional?: boolean }[],
): TsType => ({ kind: "typeLiteral", value: { properties } });

function typeAlias(
  name: string,
  tsType: TsType,
  exported = true,
  typeParams?: { name: string }[],
) {
  return {
    name,
    declarations: [
      {
        kind: "typeAlias",
        declarationKind: exported ? "export" : "private",
        def: { tsType, ...(typeParams ? { typeParams } : {}) },
        location: { filename: ENTRY, line: 1, col: 0 },
      },
    ],
  };
}

function normalize(entry: DocModule, shared?: DocModule) {
  const modules = new Map<string, DocModule>([[ENTRY, entry]]);
  if (shared) {
    modules.set(SHARED, shared);
  }
  return normalizeContract({
    slug: "fn",
    entrypointUrl: ENTRY,
    modules,
    describeModule: (url) => url.replace("file:///project/", ""),
  });
}

describe("normalizeContract", () => {
  test("a module without RequestBody or ResponseBody has no contract and no diagnostics", () => {
    const result = normalize({ symbols: [] });
    expect(result).toEqual({
      requestBody: null,
      responseBody: null,
      types: [],
      diagnostics: [],
    });
  });

  test("maps keywords, literals, arrays and tuples to their JSON kinds", () => {
    const result = normalize({
      symbols: [
        typeAlias(
          "RequestBody",
          objectLiteral([
            { name: "s", tsType: keyword("string") },
            { name: "n", tsType: keyword("number") },
            { name: "b", tsType: keyword("boolean") },
            { name: "nul", tsType: keyword("null") },
            { name: "any", tsType: keyword("any") },
            { name: "obj", tsType: keyword("object") },
            { name: "lit", tsType: literal("x") },
            {
              name: "arr",
              tsType: { kind: "array", value: keyword("string") },
            },
            {
              name: "tup",
              tsType: { kind: "tuple", value: [keyword("string"), literal(1)] },
            },
            {
              name: "tmpl",
              tsType: {
                kind: "literal",
                value: { kind: "template", tsTypes: [] },
              },
            },
          ]),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        { name: "s", type: { kind: "string" }, optional: false },
        { name: "n", type: { kind: "number" }, optional: false },
        { name: "b", type: { kind: "boolean" }, optional: false },
        { name: "nul", type: { kind: "null" }, optional: false },
        { name: "any", type: { kind: "unknown" }, optional: false },
        {
          name: "obj",
          type: {
            kind: "record",
            key: { kind: "string" },
            value: { kind: "unknown" },
          },
          optional: false,
        },
        { name: "lit", type: { kind: "literal", value: "x" }, optional: false },
        {
          name: "arr",
          type: { kind: "array", element: { kind: "string" } },
          optional: false,
        },
        {
          name: "tup",
          type: {
            kind: "tuple",
            elements: [{ kind: "string" }, { kind: "literal", value: 1 }],
          },
          optional: false,
        },
        { name: "tmpl", type: { kind: "string" }, optional: false },
      ],
    });
    expect(result.diagnostics).toEqual([]);
  });

  test("a property typed `T | undefined` becomes an optional property of T", () => {
    const result = normalize({
      symbols: [
        typeAlias(
          "RequestBody",
          objectLiteral([
            {
              name: "a",
              tsType: union(keyword("string"), keyword("undefined")),
            },
            {
              name: "b",
              tsType: {
                kind: "parenthesized",
                value: union(keyword("undefined"), keyword("number")),
              },
            },
          ]),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        { name: "a", type: { kind: "string" }, optional: true },
        { name: "b", type: { kind: "number" }, optional: true },
      ],
    });
  });

  test("unions are flattened and deduplicated, `true | false` collapses to boolean", () => {
    const result = normalize({
      symbols: [
        typeAlias(
          "RequestBody",
          union(
            literal(1),
            union(literal(2), literal(1)),
            literal(true),
            literal(false),
            keyword("null"),
          ),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "union",
      members: [
        { kind: "literal", value: 1 },
        { kind: "literal", value: 2 },
        { kind: "null" },
        { kind: "boolean" },
      ],
    });
  });

  test("a bare `undefined` outside a property is unsupported", () => {
    const result = normalize({
      symbols: [typeAlias("RequestBody", keyword("undefined"))],
    });
    expect(result.requestBody).toEqual({
      kind: "unsupported",
      repr: "undefined",
    });
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody",
        message: "The undefined type cannot be expressed as JSON.",
      },
    ]);
  });

  test("local named types become declarations referenced by name, once", () => {
    const address = objectLiteral([
      { name: "street", tsType: keyword("string") },
    ]);
    const result = normalize({
      symbols: [
        typeAlias("Address", address, false),
        typeAlias(
          "RequestBody",
          objectLiteral([
            { name: "home", tsType: ref("Address", { kind: "local" }) },
            { name: "work", tsType: ref("Address", { kind: "local" }) },
          ]),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        {
          name: "home",
          type: { kind: "reference", name: "Address" },
          optional: false,
        },
        {
          name: "work",
          type: { kind: "reference", name: "Address" },
          optional: false,
        },
      ],
    });
    expect(result.types).toEqual([
      {
        name: "Address",
        type: {
          kind: "object",
          properties: [
            { name: "street", type: { kind: "string" }, optional: false },
          ],
        },
      },
    ]);
  });

  test("recursive types reference themselves through a declaration", () => {
    const result = normalize({
      symbols: [
        typeAlias(
          "Tree",
          objectLiteral([
            {
              name: "children",
              tsType: { kind: "array", value: ref("Tree", { kind: "local" }) },
            },
          ]),
        ),
        typeAlias("RequestBody", ref("Tree", { kind: "local" })),
      ],
    });
    expect(result.requestBody).toEqual({ kind: "reference", name: "Tree" });
    expect(result.types).toEqual([
      {
        name: "Tree",
        type: {
          kind: "object",
          properties: [
            {
              name: "children",
              type: {
                kind: "array",
                element: { kind: "reference", name: "Tree" },
              },
              optional: false,
            },
          ],
        },
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  test("imported types are resolved through the module's imports, aliases included", () => {
    const shared: DocModule = {
      symbols: [
        {
          name: "Shared",
          declarations: [
            {
              kind: "interface",
              declarationKind: "export",
              def: {
                properties: [{ name: "id", tsType: keyword("string") }],
                indexSignatures: [
                  {
                    params: [{ tsType: keyword("string") }],
                    tsType: keyword("unknown"),
                  },
                ],
              },
              location: { filename: SHARED, line: 1, col: 0 },
            },
          ],
        },
      ],
    };
    const result = normalize(
      {
        imports: [{ importedName: "S", originalName: "Shared", src: SHARED }],
        symbols: [
          typeAlias(
            "RequestBody",
            ref("S", {
              kind: "import",
              specifier: "../_shared/types.ts",
              name: "Shared",
            }),
          ),
        ],
      },
      shared,
    );
    expect(result.requestBody).toEqual({ kind: "reference", name: "Shared" });
    expect(result.types).toEqual([
      {
        name: "Shared",
        type: {
          kind: "object",
          properties: [
            { name: "id", type: { kind: "string" }, optional: false },
          ],
          additionalProperties: { kind: "unknown" },
        },
      },
    ]);
  });

  test("types from npm, JSR or remote modules are unsupported with a pointer to the source", () => {
    const result = normalize({
      imports: [{ importedName: "z", originalName: "z", src: "npm:zod@4" }],
      symbols: [
        typeAlias(
          "RequestBody",
          ref("z.infer", { kind: "import", specifier: "npm:zod", name: "z" }, [
            keyword("string"),
          ]),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "unsupported",
      repr: "z.infer",
    });
    expect(result.diagnostics[0]?.message).toContain("namespace import");
  });

  test("a type imported from a module that was not documented is unsupported", () => {
    const result = normalize({
      imports: [{ importedName: "Thing", originalName: "Thing", src: SHARED }],
      symbols: [
        typeAlias(
          "RequestBody",
          ref("Thing", {
            kind: "import",
            specifier: "../_shared/types.ts",
            name: "Thing",
          }),
        ),
      ],
    });
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody",
        message:
          "Thing is declared in supabase/functions/_shared/types.ts, which was not documented.",
      },
    ]);
  });

  test("two modules declaring the same name get distinct declaration names", () => {
    const shared: DocModule = {
      symbols: [
        typeAlias(
          "Item",
          objectLiteral([{ name: "remote", tsType: keyword("string") }]),
        ),
      ],
    };
    const result = normalize(
      {
        imports: [
          { importedName: "SharedItem", originalName: "Item", src: SHARED },
        ],
        symbols: [
          typeAlias(
            "Item",
            objectLiteral([{ name: "local", tsType: keyword("string") }]),
            false,
          ),
          typeAlias(
            "RequestBody",
            objectLiteral([
              { name: "a", tsType: ref("Item", { kind: "local" }) },
              {
                name: "b",
                tsType: ref("SharedItem", {
                  kind: "import",
                  specifier: "../_shared/types.ts",
                  name: "Item",
                }),
              },
            ]),
          ),
        ],
      },
      shared,
    );
    expect(result.types.map((declaration) => declaration.name)).toEqual([
      "Item",
      "Item2",
    ]);
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody.b",
        message:
          "Item in supabase/functions/_shared/types.ts is emitted as Item2, since another module declares a Item too.",
      },
    ]);
  });

  test("generic types are instantiated inline, with defaults for missing arguments", () => {
    const result = normalize({
      symbols: [
        {
          name: "Page",
          declarations: [
            {
              kind: "interface",
              declarationKind: "private",
              def: {
                typeParams: [
                  { name: "Item" },
                  { name: "Cursor", default: keyword("string") },
                ],
                properties: [
                  {
                    name: "items",
                    tsType: {
                      kind: "array",
                      value: ref("Item", {
                        kind: "typeParam",
                        declaringName: "Page",
                        declaringKind: "interface",
                      }),
                    },
                  },
                  {
                    name: "next",
                    tsType: ref("Cursor", {
                      kind: "typeParam",
                      declaringName: "Page",
                      declaringKind: "interface",
                    }),
                  },
                ],
              },
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
        typeAlias(
          "RequestBody",
          ref("Page", { kind: "local" }, [keyword("number")]),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        {
          name: "items",
          type: { kind: "array", element: { kind: "number" } },
          optional: false,
        },
        { name: "next", type: { kind: "string" }, optional: false },
      ],
    });
    expect(result.types).toEqual([]);
  });

  test("a recursive generic type stops at the re-entry with an unsupported node", () => {
    const nodeParam = ref("T", {
      kind: "typeParam",
      declaringName: "Node",
      declaringKind: "interface",
    });
    const result = normalize({
      symbols: [
        {
          name: "Node",
          declarations: [
            {
              kind: "interface",
              declarationKind: "private",
              def: {
                typeParams: [{ name: "T" }],
                properties: [
                  { name: "value", tsType: nodeParam },
                  {
                    name: "children",
                    tsType: {
                      kind: "array",
                      value: ref("Node", { kind: "local" }, [nodeParam]),
                    },
                  },
                ],
              },
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
        typeAlias(
          "RequestBody",
          ref("Node", { kind: "local" }, [keyword("string")]),
        ),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        { name: "value", type: { kind: "string" }, optional: false },
        {
          name: "children",
          type: {
            kind: "array",
            element: { kind: "unsupported", repr: "Node" },
          },
          optional: false,
        },
      ],
    });
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody.children[]",
        message:
          "Node is a recursive generic type; give the recursion a non-generic name to include it.",
      },
    ]);
  });

  test("enums become unions of their literal values, numbering implicit members", () => {
    const result = normalize({
      symbols: [
        {
          name: "Level",
          declarations: [
            {
              kind: "enum",
              declarationKind: "export",
              def: {
                members: [
                  { name: "Low" },
                  { name: "High", init: literal(10) },
                  { name: "Higher" },
                ],
              },
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
        typeAlias("RequestBody", ref("Level", { kind: "local" })),
      ],
    });
    expect(result.types).toEqual([
      {
        name: "Level",
        type: {
          kind: "union",
          members: [
            { kind: "literal", value: 0 },
            { kind: "literal", value: 10 },
            { kind: "literal", value: 11 },
          ],
        },
      },
    ]);
  });

  test("interfaces merge what they extend; intersections of objects merge too", () => {
    const result = normalize({
      symbols: [
        {
          name: "Base",
          declarations: [
            {
              kind: "interface",
              declarationKind: "private",
              def: {
                properties: [
                  { name: "id", tsType: keyword("string") },
                  { name: "kind", tsType: literal("base") },
                ],
              },
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
        {
          name: "RequestBody",
          declarations: [
            {
              kind: "interface",
              declarationKind: "export",
              def: {
                extends: [ref("Base", { kind: "local" })],
                properties: [{ name: "kind", tsType: literal("child") }],
              },
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
        typeAlias("ResponseBody", {
          kind: "intersection",
          value: [
            ref("Base", { kind: "local" }),
            objectLiteral([{ name: "extra", tsType: keyword("boolean") }]),
            ref("Record", undefined, [keyword("string"), keyword("number")]),
          ],
        }),
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        { name: "id", type: { kind: "string" }, optional: false },
        {
          name: "kind",
          type: { kind: "literal", value: "child" },
          optional: false,
        },
      ],
    });
    expect(result.responseBody).toEqual({
      kind: "object",
      properties: [
        { name: "id", type: { kind: "string" }, optional: false },
        {
          name: "kind",
          type: { kind: "literal", value: "base" },
          optional: false,
        },
        { name: "extra", type: { kind: "boolean" }, optional: false },
      ],
      additionalProperties: { kind: "number" },
    });
  });

  test("Record, Partial, Required, Readonly, NonNullable and Array are understood", () => {
    const address = objectLiteral([
      { name: "street", tsType: keyword("string") },
      { name: "zip", tsType: keyword("string"), optional: true },
    ]);
    const result = normalize({
      symbols: [
        typeAlias("Address", address, false),
        typeAlias(
          "RequestBody",
          objectLiteral([
            {
              name: "rec",
              tsType: ref("Record", undefined, [
                keyword("string"),
                keyword("number"),
              ]),
            },
            {
              name: "keyed",
              tsType: ref("Record", undefined, [
                union(literal("a"), literal("b")),
                keyword("boolean"),
              ]),
            },
            {
              name: "badKey",
              tsType: ref("Record", undefined, [
                keyword("number"),
                keyword("boolean"),
              ]),
            },
            {
              name: "partial",
              tsType: ref("Partial", undefined, [
                ref("Address", { kind: "local" }),
              ]),
            },
            {
              name: "required",
              tsType: ref("Required", undefined, [
                ref("Address", { kind: "local" }),
              ]),
            },
            {
              name: "ro",
              tsType: ref("Readonly", undefined, [keyword("string")]),
            },
            {
              name: "nn",
              tsType: ref("NonNullable", undefined, [
                union(keyword("string"), keyword("null")),
              ]),
            },
            {
              name: "arr",
              tsType: ref("Array", undefined, [keyword("number")]),
            },
            {
              name: "roArr",
              tsType: {
                kind: "typeOperator",
                value: {
                  operator: "readonly",
                  tsType: { kind: "array", value: keyword("number") },
                },
              },
            },
          ]),
        ),
      ],
    });
    const properties = new Map(
      (
        result.requestBody as { properties: { name: string; type: unknown }[] }
      ).properties.map((p) => [p.name, p.type]),
    );
    expect(properties.get("rec")).toEqual({
      kind: "record",
      key: { kind: "string" },
      value: { kind: "number" },
    });
    expect(properties.get("keyed")).toEqual({
      kind: "record",
      key: {
        kind: "union",
        members: [
          { kind: "literal", value: "a" },
          { kind: "literal", value: "b" },
        ],
      },
      value: { kind: "boolean" },
    });
    expect(properties.get("badKey")).toEqual({
      kind: "unsupported",
      repr: "Record",
    });
    expect(properties.get("partial")).toEqual({
      kind: "object",
      properties: [
        { name: "street", type: { kind: "string" }, optional: true },
        { name: "zip", type: { kind: "string" }, optional: true },
      ],
    });
    expect(properties.get("required")).toEqual({
      kind: "object",
      properties: [
        { name: "street", type: { kind: "string" }, optional: false },
        { name: "zip", type: { kind: "string" }, optional: false },
      ],
    });
    expect(properties.get("ro")).toEqual({ kind: "string" });
    expect(properties.get("nn")).toEqual({ kind: "string" });
    expect(properties.get("arr")).toEqual({
      kind: "array",
      element: { kind: "number" },
    });
    expect(properties.get("roArr")).toEqual({
      kind: "array",
      element: { kind: "number" },
    });
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody.badKey",
        message: "Record keys must be strings or a union of string literals.",
      },
    ]);
  });

  test("constructs JSON cannot carry are unsupported and reported at their path", () => {
    const result = normalize({
      symbols: [
        typeAlias(
          "RequestBody",
          objectLiteral([
            { name: "when", tsType: ref("Date") },
            {
              name: "fn",
              tsType: { kind: "fnOrConstructor", repr: "() => void" },
            },
            { name: "idx", tsType: { kind: "indexedAccess", repr: 'A["b"]' } },
            { name: "big", tsType: keyword("bigint") },
          ]),
        ),
        {
          name: "ResponseBody",
          declarations: [
            {
              kind: "interface",
              declarationKind: "export",
              def: { properties: [], methods: [{ name: "run" }] },
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
      ],
    });
    expect(result.requestBody).toEqual({
      kind: "object",
      properties: [
        {
          name: "when",
          type: { kind: "unsupported", repr: "Date" },
          optional: false,
        },
        {
          name: "fn",
          type: { kind: "unsupported", repr: "() => void" },
          optional: false,
        },
        {
          name: "idx",
          type: { kind: "unsupported", repr: 'A["b"]' },
          optional: false,
        },
        {
          name: "big",
          type: { kind: "unsupported", repr: "bigint" },
          optional: false,
        },
      ],
    });
    expect(result.responseBody).toEqual({ kind: "object", properties: [] });
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody.when",
        message: "Date cannot be expressed as JSON.",
      },
      {
        slug: "fn",
        path: "RequestBody.fn",
        message: "A function type cannot be expressed as JSON.",
      },
      {
        slug: "fn",
        path: "RequestBody.idx",
        message:
          'A property lookup type (T["key"]) cannot be expressed as JSON.',
      },
      {
        slug: "fn",
        path: "RequestBody.big",
        message: "The bigint type cannot be expressed as JSON.",
      },
      {
        slug: "fn",
        path: "ResponseBody.run",
        message: "Methods have no JSON representation; run is left out.",
      },
    ]);
  });

  test("a body that is not exported, generic or not a type is reported and left out", () => {
    const result = normalize({
      symbols: [
        typeAlias("RequestBody", keyword("string"), false),
        typeAlias("ResponseBody", keyword("string"), true, [{ name: "T" }]),
      ],
    });
    expect(result.requestBody).toBeNull();
    expect(result.responseBody).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody",
        message:
          "RequestBody is declared but not exported, so it is not part of the contract.",
      },
      {
        slug: "fn",
        path: "ResponseBody",
        message:
          "ResponseBody is generic; a body type cannot have type parameters.",
      },
    ]);

    const variable = normalize({
      symbols: [
        {
          name: "RequestBody",
          declarations: [
            {
              kind: "variable",
              declarationKind: "export",
              location: { filename: ENTRY, line: 1, col: 0 },
            },
          ],
        },
      ],
    });
    expect(variable.diagnostics).toEqual([
      {
        slug: "fn",
        path: "RequestBody",
        message:
          "RequestBody must be a type alias, an interface or an enum to describe a body.",
      },
    ]);
  });
});
