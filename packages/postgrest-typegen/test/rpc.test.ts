import { describe, expect, test } from "bun:test";

import { resolveRpcFunctions } from "../src/rpc.ts";
import type { PostgresFunction, PostgresType } from "../src/types.ts";
import {
  addressCompositeType,
  baseColumn,
  baseFunction,
  baseTable,
  baseView,
  buildMetadata,
  int4Type,
  textType,
  userStatusEnum,
} from "./generation/fixtures.ts";

const todosRowType: PostgresType = {
  id: 500,
  name: "todos",
  schema: "public",
  format: "todos",
  enums: [],
  attributes: [],
  comment: null,
  type_relation_id: 1,
};

const usersRowType: PostgresType = {
  id: 501,
  name: "users",
  schema: "public",
  format: "users",
  enums: [],
  attributes: [],
  comment: null,
  type_relation_id: 2,
};

const jsonbType: PostgresType = {
  id: 3802,
  name: "jsonb",
  schema: "pg_catalog",
  format: "jsonb",
  enums: [],
  attributes: [],
  comment: null,
  type_relation_id: null,
};

const arg = (
  name: string,
  typeId: number,
  overrides: Partial<PostgresFunction["args"][number]> = {},
): PostgresFunction["args"][number] => ({
  mode: "in",
  name,
  type_id: typeId,
  has_default: false,
  ...overrides,
});

const metadataWith = (functions: PostgresFunction[]) =>
  buildMetadata({
    tables: [
      baseTable({ id: 1, name: "todos" }),
      baseTable({ id: 2, name: "users" }),
    ],
    views: [baseView({ id: 3, name: "todos_view" })],
    columns: [
      baseColumn({ table_id: 1, table: "todos", name: "id", format: "int4" }),
      baseColumn({
        table_id: 1,
        table: "todos",
        name: "title",
        format: "text",
      }),
      baseColumn({ table_id: 2, table: "users", name: "id", format: "int4" }),
    ],
    functions,
    types: [
      userStatusEnum,
      addressCompositeType,
      int4Type,
      textType,
      jsonbType,
      todosRowType,
      usersRowType,
    ],
  });

const only = (functions: PostgresFunction[]) => {
  const resolved = resolveRpcFunctions(metadataWith(functions));
  expect(resolved).toHaveLength(1);
  const [fn] = resolved;
  if (!fn) throw new Error("unreachable");
  return fn;
};

describe("resolveRpcFunctions", () => {
  describe("which functions PostgREST exposes", () => {
    test("a function with no parameters", () => {
      expect(only([baseFunction({ name: "ping" })]).overloads).toHaveLength(1);
    });

    test("a function whose parameters are all named", () => {
      const fn = only([
        baseFunction({
          name: "add",
          args: [arg("a", 23), arg("b", 23, { has_default: true })],
          argument_types: "a integer, b integer DEFAULT 1",
        }),
      ]);
      expect(fn.overloads[0]?.args).toEqual([
        {
          name: "a",
          mode: "in",
          type_id: 23,
          format: "int4",
          type_schema: "pg_catalog",
          has_default: false,
          relation_id: null,
        },
        {
          name: "b",
          mode: "in",
          type_id: 23,
          format: "int4",
          type_schema: "pg_catalog",
          has_default: true,
          relation_id: null,
        },
      ]);
    });

    test("a single unnamed json, jsonb or text parameter", () => {
      expect(
        resolveRpcFunctions(
          metadataWith([
            baseFunction({ id: 1, name: "by_text", args: [arg("", 25)] }),
            baseFunction({ id: 2, name: "by_jsonb", args: [arg("", 3802)] }),
            baseFunction({ id: 3, name: "by_int", args: [arg("", 23)] }),
          ]),
        ).map((fn) => fn.name),
      ).toEqual(["by_jsonb", "by_text"]);
    });

    test("unnamed parameters only when every one is json-like with a default", () => {
      expect(
        resolveRpcFunctions(
          metadataWith([
            baseFunction({
              id: 1,
              name: "defaulted",
              args: [
                arg("a", 23),
                arg("", 25, { has_default: true }),
                arg("", 3802, { has_default: true }),
              ],
            }),
            baseFunction({
              id: 2,
              name: "not_defaulted",
              args: [arg("a", 23), arg("", 25)],
            }),
            baseFunction({
              id: 3,
              name: "two_unnamed_ints",
              args: [arg("", 23), arg("", 23)],
            }),
          ]),
        ).map((fn) => fn.name),
      ).toEqual(["defaulted"]);
    });

    test("a single unnamed row parameter, whatever it returns", () => {
      expect(
        resolveRpcFunctions(
          metadataWith([
            baseFunction({ id: 1, name: "scalar", args: [arg("", 500)] }),
            baseFunction({
              id: 2,
              name: "rows",
              args: [arg("", 500)],
              return_type_id: 501,
              return_type: "users",
              return_type_relation_id: 2,
            }),
          ]),
        ).map((fn) => fn.name),
      ).toEqual(["rows", "scalar"]);
    });

    test("only input modes count as parameters", () => {
      const fn = only([
        baseFunction({
          name: "with_out",
          args: [
            arg("a", 23),
            arg("b", 23, { mode: "inout" }),
            arg("rest", 23, { mode: "variadic" }),
            arg("", 25, { mode: "out", has_default: null }),
          ],
        }),
      ]);
      expect(fn.overloads[0]?.args.map((a) => [a.name, a.mode])).toEqual([
        ["a", "in"],
        ["b", "inout"],
        ["rest", "variadic"],
      ]);
    });

    test("functions outside the listed schemas are left out", () => {
      expect(
        resolveRpcFunctions(
          metadataWith([baseFunction({ schema: "private", name: "hidden" })]),
        ),
      ).toEqual([]);
    });
  });

  describe("return shapes", () => {
    test("a scalar", () => {
      expect(only([baseFunction({ name: "count" })]).overloads[0]).toEqual(
        expect.objectContaining({
          returns: {
            type_id: 23,
            format: "int4",
            type_schema: "pg_catalog",
            relation_id: null,
            columns: null,
          },
          is_set_returning: false,
          setof_options: null,
          computed_field_of: null,
          error: null,
        }),
      );
    });

    test("a type that is not in the metadata", () => {
      expect(
        only([baseFunction({ name: "mystery", return_type_id: 9999 })])
          .overloads[0]?.returns,
      ).toEqual({
        type_id: 9999,
        format: null,
        type_schema: null,
        relation_id: null,
        columns: null,
      });
    });

    test("RETURNS TABLE columns in name order", () => {
      const fn = only([
        baseFunction({
          name: "report",
          args: [
            arg("user_id", 23),
            arg("title", 25, { mode: "table", has_default: null }),
            arg("id", 23, { mode: "table", has_default: null }),
          ],
          return_type_id: 2249,
          return_type: "TABLE(title text, id integer)",
          is_set_returning_function: true,
          prorows: 1000,
        }),
      ]);
      expect(fn.overloads[0]?.returns).toEqual({
        type_id: 2249,
        format: null,
        type_schema: null,
        relation_id: null,
        columns: [
          {
            name: "id",
            type_id: 23,
            format: "int4",
            type_schema: "pg_catalog",
          },
          {
            name: "title",
            type_id: 25,
            format: "text",
            type_schema: "pg_catalog",
          },
        ],
      });
      expect(fn.overloads[0]?.rows_estimate).toBe(1000);
    });

    test("rows of a relation, embeddable from `*`", () => {
      const fn = only([
        baseFunction({
          name: "all_users",
          return_type_id: 501,
          return_type: "SETOF users",
          return_type_relation_id: 2,
          is_set_returning_function: true,
          prorows: 1000,
        }),
      ]);
      expect(fn.overloads[0]?.returns.relation_id).toBe(2);
      expect(fn.overloads[0]?.setof_options).toEqual({
        from: "*",
        to: "users",
        is_one_to_one: false,
        is_setof_return: true,
      });
    });

    test("a ROWS 1 set of a relation is one to one", () => {
      const fn = only([
        baseFunction({
          name: "one_user",
          return_type_id: 501,
          return_type: "SETOF users",
          return_type_relation_id: 2,
          is_set_returning_function: true,
          prorows: 1,
        }),
      ]);
      expect(fn.overloads[0]?.setof_options?.is_one_to_one).toBe(true);
    });

    test("a composite type is embeddable under its own name", () => {
      const fn = only([
        baseFunction({
          name: "home",
          return_type_id: 200,
          return_type: "address",
          return_type_relation_id: 200,
        }),
      ]);
      expect(fn.overloads[0]?.returns).toEqual(
        expect.objectContaining({ format: "address", relation_id: null }),
      );
      expect(fn.overloads[0]?.setof_options).toEqual({
        from: "*",
        to: "address",
        is_one_to_one: true,
        is_setof_return: false,
      });
    });

    test("rows embedded from a sole row parameter", () => {
      const fn = only([
        baseFunction({
          name: "user_todos",
          args: [arg("user_row", 501)],
          argument_types: "user_row users",
          return_type_id: 500,
          return_type: "SETOF todos",
          return_type_relation_id: 1,
          is_set_returning_function: true,
          prorows: 1000,
        }),
      ]);
      expect(fn.overloads[0]?.args[0]?.relation_id).toBe(2);
      expect(fn.overloads[0]?.setof_options).toEqual({
        from: "users",
        to: "todos",
        is_one_to_one: false,
        is_setof_return: true,
      });
    });

    test("a single row from a sole row parameter is one to one", () => {
      const fn = only([
        baseFunction({
          name: "owner",
          args: [arg("todo", 500)],
          argument_types: "todo todos",
          return_type_id: 501,
          return_type: "users",
          return_type_relation_id: 2,
        }),
      ]);
      expect(fn.overloads[0]?.setof_options).toEqual({
        from: "todos",
        to: "users",
        is_one_to_one: true,
        is_setof_return: false,
      });
    });
  });

  describe("computed fields", () => {
    const scalarOnRow = (name: string, argName: string, typeId = 500) =>
      baseFunction({
        name,
        args: [arg(argName, typeId)],
        argument_types: argName ? `${argName} todos` : "todos",
        return_type_id: 25,
        return_type: "text",
      });

    test("a sole row parameter, named or not", () => {
      expect(
        resolveRpcFunctions(
          metadataWith([
            scalarOnRow("summary", ""),
            baseFunction({ ...scalarOnRow("slug", "todo"), id: 301 }),
          ]),
        ).map((fn) => [fn.name, fn.overloads[0]?.computed_field_of]),
      ).toEqual([
        ["slug", 1],
        ["summary", 1],
      ]);
    });

    test("not when a column of the relation has the function's name", () => {
      expect(
        only([scalarOnRow("title", "")]).overloads[0]?.computed_field_of,
      ).toBeNull();
    });

    test("not when the relation is in another schema", () => {
      const metadata = metadataWith([scalarOnRow("summary", "")]);
      metadata.tables = metadata.tables.map((table) =>
        table.id === 1 ? { ...table, schema: "other" } : table,
      );
      expect(
        resolveRpcFunctions(metadata)[0]?.overloads[0]?.computed_field_of,
      ).toBeNull();
    });

    test("by the rendered argument list when the type is not in the metadata", () => {
      const metadata = metadataWith([scalarOnRow("summary", "todo", 9999)]);
      expect(
        resolveRpcFunctions(metadata)[0]?.overloads[0]?.computed_field_of,
      ).toBeNull();
      metadata.functions[0]!.argument_types = "todos";
      expect(
        resolveRpcFunctions(metadata)[0]?.overloads[0]?.computed_field_of,
      ).toBe(1);
    });

    test("an unnamed computed field is never callable, whatever it returns", () => {
      const message =
        "the function public.summary with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache";
      expect(only([scalarOnRow("summary", "")]).overloads[0]?.error).toBe(
        message,
      );

      // A computed relationship keeps its embedding metadata but is not
      // callable either: PostgREST only passes a sole unnamed parameter when
      // it is json, jsonb or text.
      const [relationship] = only([
        baseFunction({
          name: "summary",
          args: [arg("", 500)],
          argument_types: "todos",
          return_type_id: 501,
          return_type: "SETOF users",
          return_type_relation_id: 2,
          is_set_returning_function: true,
          prorows: 1000,
        }),
      ]).overloads;
      expect(relationship?.error).toBe(message);
      expect(relationship?.computed_field_of).toBe(1);
      expect(relationship?.setof_options).toEqual({
        from: "todos",
        to: "users",
        is_one_to_one: false,
        is_setof_return: true,
      });
    });
  });

  describe("overloads", () => {
    test("group by schema and name, ordered by argument list then return type", () => {
      const resolved = resolveRpcFunctions(
        buildMetadata({
          schemas: [
            { id: 1, name: "public", owner: "postgres" },
            { id: 2, name: "other", owner: "postgres" },
          ],
          functions: [
            baseFunction({
              id: 3,
              name: "f",
              args: [arg("b", 25)],
              argument_types: "b text",
            }),
            baseFunction({ id: 2, schema: "other", name: "f" }),
            baseFunction({
              id: 1,
              name: "f",
              args: [arg("a", 23)],
              argument_types: "a integer",
            }),
            baseFunction({ id: 4, name: "e" }),
          ],
          types: [int4Type, textType],
        }),
      );
      expect(
        resolved.map((fn) => [
          fn.schema,
          fn.name,
          fn.overloads.map((o) => o.function_id),
        ]),
      ).toEqual([
        ["other", "f", [2]],
        ["public", "e", [4]],
        ["public", "f", [1, 3]],
      ]);
    });

    test("a no-parameter overload conflicts with a defaulted unnamed one", () => {
      const fn = only([
        baseFunction({ id: 1, name: "f" }),
        baseFunction({
          id: 2,
          name: "f",
          args: [arg("", 25, { has_default: true })],
          argument_types: "text DEFAULT ''",
          return_type_id: 25,
          return_type: "text",
        }),
      ]);
      expect(fn.overloads.map((o) => o.error)).toEqual([
        "Could not choose the best candidate function between: public.f(), public.f( => text). Try renaming the parameters or the function itself in the database so function overloading can be resolved",
        null,
      ]);
    });

    test("sole parameters sharing a name but not a type conflict", () => {
      const fn = only([
        baseFunction({
          id: 1,
          name: "f",
          args: [arg("a", 25)],
          argument_types: "a text",
        }),
        baseFunction({
          id: 2,
          name: "f",
          args: [arg("a", 23)],
          argument_types: "a integer",
        }),
        baseFunction({
          id: 3,
          name: "f",
          args: [arg("b", 23)],
          argument_types: "b integer",
        }),
      ]);
      const conflict =
        "Could not choose the best candidate function between: public.f(a => int4), public.f(a => text). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
      expect(fn.overloads.map((o) => [o.function_id, o.error])).toEqual([
        [2, conflict],
        [1, conflict],
        [3, null],
      ]);
    });
  });

  test("is pure and independent of input order", () => {
    const functions = [
      baseFunction({
        id: 1,
        name: "b",
        args: [arg("z", 23), arg("a", 25)],
        argument_types: "z integer, a text",
      }),
      baseFunction({ id: 2, name: "a" }),
      baseFunction({
        id: 3,
        name: "b",
        args: [arg("", 500)],
        argument_types: "todos",
        return_type_id: 501,
        return_type: "users",
        return_type_relation_id: 2,
      }),
    ];
    const forward = metadataWith(functions);
    const backward = metadataWith([...functions].reverse());
    const before = structuredClone(forward);
    expect(resolveRpcFunctions(forward)).toEqual(resolveRpcFunctions(backward));
    expect(forward).toEqual(before);
    expect(
      resolveRpcFunctions(forward)[1]?.overloads[1]?.args.map((a) => a.name),
    ).toEqual(["a", "z"]);
  });
});
