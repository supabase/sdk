import { describe, expect, test } from "bun:test";

import { sortGeneratorMetadata } from "../src/sort.ts";
import type { PostgresType } from "../src/types.ts";
import {
  addressCompositeType,
  baseColumn,
  baseFunction,
  baseRelationship,
  baseTable,
  baseView,
  buildMetadata,
  userStatusEnum,
} from "./generation/fixtures.ts";

describe("sortGeneratorMetadata", () => {
  test("orders names with a fixed collation, independent of the host locale", () => {
    // An English collation puts "ä" next to "a"; Swedish would put it after
    // "z". The order must not change with the machine that runs the generator.
    const result = sortGeneratorMetadata(
      buildMetadata({
        tables: [
          baseTable({ id: 1, name: "z" }),
          baseTable({ id: 2, name: "b" }),
          baseTable({ id: 3, name: "ä" }),
          baseTable({ id: 4, name: "a" }),
        ],
      }),
    );
    expect(result.tables.map((t) => t.name)).toEqual(["a", "ä", "b", "z"]);
  });

  test("orders by semantic keys (schema/name), NOT by oid", () => {
    // ids deliberately disagree with names so the assertions prove the sort is
    // name-based — an oid sort would yield a different order, and oids are not
    // stable across equivalent databases.
    const shuffled = buildMetadata({
      tables: [
        baseTable({ id: 3, name: "a" }),
        baseTable({ id: 1, name: "b" }),
        baseTable({ id: 2, name: "c" }),
      ],
      views: [
        baseView({ id: 9, name: "v_a" }),
        baseView({ id: 5, name: "v_b" }),
      ],
      functions: [
        baseFunction({ id: 20, name: "f_a" }),
        baseFunction({ id: 10, name: "f_b" }),
      ],
      columns: [
        baseColumn({ table_id: 1, table: "b", ordinal_position: 1, name: "x" }),
        baseColumn({ table_id: 3, table: "a", ordinal_position: 2, name: "y" }),
        baseColumn({ table_id: 3, table: "a", ordinal_position: 1, name: "z" }),
      ],
    });

    const result = sortGeneratorMetadata(shuffled);
    expect(result.tables.map((t) => t.name)).toEqual(["a", "b", "c"]);
    expect(result.tables.map((t) => t.id)).toEqual([3, 1, 2]);
    expect(result.views.map((v) => v.name)).toEqual(["v_a", "v_b"]);
    expect(result.functions.map((f) => f.name)).toEqual(["f_a", "f_b"]);
    // Columns grouped by (schema, table), name-ordered within a table
    // (mirrors the TypeScript generator's per-table column sort).
    expect(result.columns.map((c) => [c.table, c.name])).toEqual([
      ["a", "y"],
      ["a", "z"],
      ["b", "x"],
    ]);
  });

  test("groups primary keys by table, preserving composite-key column order", () => {
    const shuffled = buildMetadata({
      tables: [
        baseTable({ id: 3, name: "a" }),
        baseTable({ id: 1, name: "b" }),
      ],
      primaryKeys: [
        { schema: "public", table_name: "b", name: "id", table_id: 1 },
        // Composite key on "a": declared column order (tenant_id, id) is
        // semantic and must survive the table-grouping sort.
        { schema: "public", table_name: "a", name: "tenant_id", table_id: 3 },
        { schema: "public", table_name: "a", name: "id", table_id: 3 },
      ],
    });

    const result = sortGeneratorMetadata(shuffled);
    expect(result.primaryKeys.map((pk) => [pk.table_name, pk.name])).toEqual([
      ["a", "tenant_id"],
      ["a", "id"],
      ["b", "id"],
    ]);
  });

  test("disambiguates overloaded functions by signature", () => {
    const result = sortGeneratorMetadata(
      buildMetadata({
        functions: [
          baseFunction({ id: 2, name: "f", identity_argument_types: "text" }),
          baseFunction({
            id: 1,
            name: "f",
            identity_argument_types: "integer",
          }),
        ],
      }),
    );
    expect(result.functions.map((f) => f.identity_argument_types)).toEqual([
      "integer",
      "text",
    ]);
  });

  test("orders the view copies of one foreign key by referencing side", () => {
    // Every copy shares the foreign key name and the referenced side; only the
    // relation, its schema and the view columns differ.
    const copies = [
      baseRelationship({ relation: "tickets_view", columns: ["owner_id"] }),
      baseRelationship({ schema: "reporting", relation: "tickets" }),
      baseRelationship({ relation: "tickets_view", columns: ["assignee_id"] }),
      baseRelationship(),
    ];
    const expected = [
      ["public", "tickets", ["owner_id"]],
      ["public", "tickets_view", ["assignee_id"]],
      ["public", "tickets_view", ["owner_id"]],
      ["reporting", "tickets", ["owner_id"]],
    ];
    const order = (result: { relationships: typeof copies }) =>
      result.relationships.map((r) => [r.schema, r.relation, r.columns]);

    expect(
      order(sortGeneratorMetadata(buildMetadata({ relationships: copies }))),
    ).toEqual(expected);
    expect(
      order(
        sortGeneratorMetadata(
          buildMetadata({ relationships: [...copies].reverse() }),
        ),
      ),
    ).toEqual(expected);
  });

  test("is idempotent", () => {
    const sorted = sortGeneratorMetadata(
      buildMetadata({
        tables: [
          baseTable({ id: 2, name: "a" }),
          baseTable({ id: 1, name: "b" }),
        ],
        relationships: [baseRelationship()],
      }),
    );
    expect(sortGeneratorMetadata(sorted)).toEqual(sorted);
  });

  test("does not mutate the input", () => {
    const input = buildMetadata({
      tables: [
        baseTable({ id: 1, name: "b" }),
        baseTable({ id: 2, name: "a" }),
      ],
    });
    const before = input.tables.map((t) => t.name);
    sortGeneratorMetadata(input);
    expect(input.tables.map((t) => t.name)).toEqual(before);
  });

  test("sorts function args by name (TS-aligned) but preserves enum values and composite attributes", () => {
    const args = [
      { mode: "in" as const, name: "z", type_id: 23, has_default: false },
      { mode: "in" as const, name: "a", type_id: 23, has_default: false },
    ];
    const reversedEnum: PostgresType = {
      ...userStatusEnum,
      enums: ["INACTIVE", "ACTIVE"],
    };
    const result = sortGeneratorMetadata(
      buildMetadata({
        functions: [baseFunction({ id: 1, name: "f", args })],
        // addressCompositeType.attributes are [street, city] — non-alphabetical.
        types: [reversedEnum, addressCompositeType],
      }),
    );
    // RPC args are addressed by name, so the generated type is order-insensitive
    // and we sort them (matches TypeScript).
    expect(result.functions[0].args.map((a) => a.name)).toEqual(["a", "z"]);
    // Enum values and composite attribute order are semantic → left untouched.
    const e = result.types.find((t) => t.name === userStatusEnum.name)!;
    expect(e.enums).toEqual(["INACTIVE", "ACTIVE"]);
    const c = result.types.find((t) => t.name === addressCompositeType.name)!;
    expect(c.attributes.map((a) => a.name)).toEqual(["street", "city"]);
  });
});
