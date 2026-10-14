import { describe, expect, test } from "bun:test";

import { parseModule } from "../src/parse.ts";

const URL = "file:///project/supabase/functions/greet/index.ts";
const resolve = (specifier: string) =>
  specifier.startsWith(".")
    ? `file:///project/supabase/functions/_shared/${specifier.split("/").pop()}`
    : specifier;

function parse(source: string) {
  return parseModule({ url: URL, source, resolve });
}

describe("parseModule", () => {
  test("records imports with their resolved source and original names", () => {
    const module = parse(`
      import type { Shared as S, Ids } from "../_shared/types.ts";
      import * as NS from "../_shared/ns.ts";
      import Def, { z } from "npm:zod";
    `);
    expect(module.imports).toEqual([
      {
        importedName: "S",
        originalName: "Shared",
        specifier: "../_shared/types.ts",
        src: "file:///project/supabase/functions/_shared/types.ts",
      },
      {
        importedName: "Ids",
        originalName: "Ids",
        specifier: "../_shared/types.ts",
        src: "file:///project/supabase/functions/_shared/types.ts",
      },
      {
        importedName: "NS",
        originalName: "*",
        specifier: "../_shared/ns.ts",
        src: "file:///project/supabase/functions/_shared/ns.ts",
      },
      {
        importedName: "Def",
        originalName: "default",
        specifier: "npm:zod",
        src: "npm:zod",
      },
      {
        importedName: "z",
        originalName: "z",
        specifier: "npm:zod",
        src: "npm:zod",
      },
    ]);
  });

  test("records re-exports, star re-exports and renamed local exports", () => {
    const module = parse(`
      type Hidden = { a: string };
      export { Hidden as RequestBody };
      export type { Q, R as R2 } from "../_shared/z.ts";
      export * from "../_shared/y.ts";
    `);
    expect(module.reexports).toEqual([
      {
        exportedName: "Q",
        originalName: "Q",
        specifier: "../_shared/z.ts",
        src: "file:///project/supabase/functions/_shared/z.ts",
      },
      {
        exportedName: "R2",
        originalName: "R",
        specifier: "../_shared/z.ts",
        src: "file:///project/supabase/functions/_shared/z.ts",
      },
    ]);
    expect(module.starReexports).toEqual([
      {
        specifier: "../_shared/y.ts",
        src: "file:///project/supabase/functions/_shared/y.ts",
      },
    ]);
    const requestBody = module.symbols.find(
      (symbol) => symbol.name === "RequestBody",
    );
    expect(requestBody?.declarations[0]).toMatchObject({
      kind: "typeAlias",
      declarationKind: "export",
      def: {
        tsType: {
          kind: "typeRef",
          value: { typeName: "Hidden", resolution: { kind: "local" } },
        },
      },
    });
    expect(
      module.symbols.find((symbol) => symbol.name === "Hidden")?.declarations[0]
        ?.declarationKind,
    ).toBe("private");
  });

  test("marks a declaration exported through a later export list", () => {
    const module = parse(`
      interface ResponseBody { ok: boolean }
      export { ResponseBody };
    `);
    expect(module.symbols[0]?.declarations[0]?.declarationKind).toBe("export");
  });

  test("an export list entry that names an import becomes a re-export", () => {
    const module = parse(`
      import type { Shared, Other } from "../_shared/types.ts";
      import Fallback from "./fallback.ts";
      import * as ns from "./ns.ts";
      export type { Shared };
      export { Other as RequestBody, Fallback as ResponseBody, ns };
    `);
    expect(module.reexports).toEqual([
      {
        exportedName: "Shared",
        originalName: "Shared",
        specifier: "../_shared/types.ts",
        src: "file:///project/supabase/functions/_shared/types.ts",
      },
      {
        exportedName: "RequestBody",
        originalName: "Other",
        specifier: "../_shared/types.ts",
        src: "file:///project/supabase/functions/_shared/types.ts",
      },
      {
        exportedName: "ResponseBody",
        originalName: "default",
        specifier: "./fallback.ts",
        src: "file:///project/supabase/functions/_shared/fallback.ts",
      },
    ]);
    expect(module.symbols).toEqual([]);
  });

  test("converts every type expression into the model the normalizer reads", () => {
    const module = parse(`
      import type { Shared } from "../_shared/types.ts";
      export type RequestBody<T = string> = {
        a?: string | null;
        readonly b: Array<number>;
        [k: string]: unknown;
        m(): void;
        c: (string | number)[];
        t: [string, number?, ...boolean[]];
        n: -1 | 2.5 | true | "x" | \`x\${string}\`;
        k: keyof Shared;
        q: Shared["id"];
        f: () => void;
        g: T;
        s: Shared;
        ns: NS.Thing<string>;
        d: Date;
        "quoted-key": bigint;
        1: undefined;
        obj: object;
      };
    `);
    const alias = module.symbols[0]!.declarations[0]!;
    expect(alias.kind).toBe("typeAlias");
    const def = (
      alias as {
        def: {
          tsType: { value: { properties: unknown[] } };
          typeParams: unknown[];
        };
      }
    ).def;
    expect(def.typeParams).toEqual([
      {
        name: "T",
        default: { kind: "keyword", repr: "string", value: "string" },
      },
    ]);
    const literal = def.tsType as {
      kind: string;
      value: {
        properties: {
          name: string;
          optional?: boolean;
          readonly?: boolean;
          tsType: unknown;
        }[];
        indexSignatures: unknown[];
        methods: unknown[];
      };
    };
    expect(literal.kind).toBe("typeLiteral");
    const byName = new Map(
      literal.value.properties.map((property) => [property.name, property]),
    );
    expect(byName.get("a")).toMatchObject({
      optional: true,
      tsType: {
        kind: "union",
        value: [
          { kind: "keyword", value: "string" },
          { kind: "keyword", value: "null" },
        ],
      },
    });
    expect(byName.get("b")).toMatchObject({
      readonly: true,
      tsType: {
        kind: "typeRef",
        value: {
          typeName: "Array",
          typeParams: [{ kind: "keyword", value: "number" }],
        },
      },
    });
    expect(
      (byName.get("b")!.tsType as { value: { resolution?: unknown } }).value
        .resolution,
    ).toBeUndefined();
    expect(literal.value.indexSignatures).toEqual([
      {
        params: [
          {
            name: "k",
            tsType: { kind: "keyword", repr: "string", value: "string" },
          },
        ],
        tsType: { kind: "keyword", repr: "unknown", value: "unknown" },
      },
    ]);
    expect(literal.value.methods).toEqual([{ name: "m" }]);
    expect(byName.get("c")!.tsType).toMatchObject({
      kind: "array",
      value: { kind: "union" },
    });
    expect(byName.get("t")!.tsType).toMatchObject({
      kind: "tuple",
      value: [
        { kind: "keyword", value: "string" },
        { kind: "optional", value: { kind: "keyword", value: "number" } },
        { kind: "rest" },
      ],
    });
    expect(byName.get("n")!.tsType).toMatchObject({
      kind: "union",
      value: [
        { kind: "literal", value: { kind: "number", number: -1 } },
        { kind: "literal", value: { kind: "number", number: 2.5 } },
        { kind: "literal", value: { kind: "boolean", boolean: true } },
        { kind: "literal", value: { kind: "string", string: "x" } },
        { kind: "literal", value: { kind: "template" } },
      ],
    });
    expect(byName.get("k")!.tsType).toMatchObject({
      kind: "typeOperator",
      value: { operator: "keyof" },
    });
    expect(byName.get("q")!.tsType).toMatchObject({
      kind: "indexedAccess",
      repr: 'Shared["id"]',
    });
    expect(byName.get("f")!.tsType).toMatchObject({
      kind: "fnOrConstructor",
      repr: "() => void",
    });
    expect(byName.get("g")!.tsType).toMatchObject({
      kind: "typeRef",
      value: { typeName: "T", resolution: { kind: "typeParam" } },
    });
    expect(byName.get("s")!.tsType).toMatchObject({
      kind: "typeRef",
      value: { typeName: "Shared", resolution: { kind: "import" } },
    });
    expect(byName.get("ns")!.tsType).toMatchObject({
      kind: "typeRef",
      value: {
        typeName: "NS.Thing",
        typeParams: [{ kind: "keyword", value: "string" }],
      },
    });
    expect(byName.get("d")!.tsType).toMatchObject({
      kind: "typeRef",
      repr: "Date",
      value: { typeName: "Date" },
    });
    expect(byName.get("quoted-key")!.tsType).toMatchObject({
      kind: "keyword",
      value: "bigint",
    });
    expect(byName.get("1")!.tsType).toMatchObject({
      kind: "keyword",
      value: "undefined",
    });
    expect(byName.get("obj")!.tsType).toMatchObject({
      kind: "keyword",
      value: "object",
    });
  });

  test("converts interfaces with heritage and type parameters, and enums with literal and computed members", () => {
    const module = parse(`
      import type { Shared } from "../_shared/types.ts";
      export interface ResponseBody<T, U = number> extends Shared, NS.Thing<T> { c: U }
      export enum E { X = "x", Y = 2, Z, W = -3, C = 1 + 1 }
      export const handler = () => {};
      export class K {}
      export default { fetch: handler };
    `);
    const [response, enumeration, handler, klass, def] = module.symbols;
    expect(response?.declarations[0]).toMatchObject({
      kind: "interface",
      declarationKind: "export",
      def: {
        typeParams: [
          { name: "T" },
          { name: "U", default: { kind: "keyword", value: "number" } },
        ],
        extends: [
          {
            kind: "typeRef",
            value: { typeName: "Shared", resolution: { kind: "import" } },
          },
          {
            kind: "typeRef",
            value: {
              typeName: "NS.Thing",
              typeParams: [
                {
                  kind: "typeRef",
                  value: { typeName: "T", resolution: { kind: "typeParam" } },
                },
              ],
            },
          },
        ],
        properties: [
          {
            name: "c",
            tsType: {
              kind: "typeRef",
              value: { typeName: "U", resolution: { kind: "typeParam" } },
            },
          },
        ],
      },
    });
    expect(enumeration?.declarations[0]).toMatchObject({
      kind: "enum",
      def: {
        members: [
          {
            name: "X",
            init: { kind: "literal", value: { kind: "string", string: "x" } },
          },
          {
            name: "Y",
            init: { kind: "literal", value: { kind: "number", number: 2 } },
          },
          { name: "Z" },
          {
            name: "W",
            init: { kind: "literal", value: { kind: "number", number: -3 } },
          },
          { name: "C", init: { kind: "computed", repr: "1 + 1" } },
        ],
      },
    });
    expect(handler?.declarations[0]).toMatchObject({
      kind: "variable",
      declarationKind: "export",
    });
    expect(klass?.declarations[0]).toMatchObject({
      kind: "class",
      declarationKind: "export",
    });
    expect(def?.name).toBe("default");
  });

  test("recovers from a recoverable syntax error and reports it with its position", () => {
    const module = parse(
      "export type RequestBody = { a: string };\nlet x = 1;\nlet x = 2;\nexport type ResponseBody = { b: number };",
    );
    expect(module.parseErrors).toHaveLength(1);
    expect(module.parseErrors?.[0]).toMatch(/^\d+:\d+ /);
    expect(module.symbols.map((symbol) => symbol.name)).toEqual([
      "RequestBody",
      "x",
      "ResponseBody",
    ]);
  });

  test("a fatal syntax error yields no symbols and one error", () => {
    const module = parse("export type RequestBody = { a: string");
    expect(module.symbols).toEqual([]);
    expect(module.parseErrors).toHaveLength(1);
    expect(module.parseErrors?.[0]).toMatch(/^\d+:\d+ /);
  });
});
