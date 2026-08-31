import { describe, expect, test } from "bun:test";

import {
  GENERATOR_METADATA_VERSION,
  generatorMetadataJsonSchema,
  generatorMetadataSchema,
  type GeneratorMetadata,
  parseGeneratorMetadata,
  type PostgresColumn,
  type PostgresForeignTable,
  type PostgresFunction,
  type PostgresMaterializedView,
  type PostgresPrimaryKey,
  type PostgresRelationship,
  type PostgresSchema,
  type PostgresTable,
  type PostgresType,
  type PostgresView,
  serializeGeneratorMetadata,
} from "../../src/types.ts";
import {
  addressCompositeType,
  baseColumn,
  baseFunction,
  baseRelationship,
  baseTable,
  buildMetadata,
  textType,
  userStatusEnum,
} from "../generation/fixtures.ts";

/**
 * Compile-time equivalence: the ArkType-derived types must stay structurally
 * identical to the frozen public contract (the original hand-written
 * interfaces, copied verbatim below). If ArkType's `.infer` drifts — e.g. an
 * optional key becomes `| undefined`, or a union changes — `assertEquals`
 * fails to compile. This is what lets ArkType be the single source of truth
 * without silently changing postgres-meta's consumed shapes.
 */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const assertEquals = <_Expected extends true>(): void => {};

// --- Frozen copies of the original interfaces (the contract to preserve) ---

interface ExpectedPostgresColumn {
  table_id: number;
  schema: string;
  table: string;
  id: string;
  ordinal_position: number;
  name: string;
  default_value: unknown;
  data_type: string;
  format: string;
  type_schema: string;
  is_identity: boolean;
  identity_generation: "ALWAYS" | "BY DEFAULT" | null;
  is_generated: boolean;
  is_nullable: boolean;
  is_updatable: boolean;
  is_unique: boolean;
  enums: string[];
  check: string | null;
  comment: string | null;
}

interface ExpectedPostgresForeignTable {
  id: number;
  schema: string;
  name: string;
  comment: string | null;
  columns?: ExpectedPostgresColumn[];
}

interface ExpectedPostgresFunction {
  id: number;
  schema: string;
  name: string;
  language: string;
  definition: string;
  complete_statement: string;
  args: {
    mode: "in" | "out" | "inout" | "variadic" | "table";
    name: string;
    type_id: number;
    has_default: boolean | null;
  }[];
  argument_types: string;
  identity_argument_types: string;
  return_type_id: number;
  return_type: string;
  return_type_relation_id: number | null;
  is_set_returning_function: boolean;
  prorows: number | null;
  behavior: "IMMUTABLE" | "STABLE" | "VOLATILE";
  security_definer: boolean;
  config_params: Record<string, string> | null;
}

interface ExpectedPostgresMaterializedView {
  id: number;
  schema: string;
  name: string;
  is_populated: boolean;
  comment: string | null;
  columns?: ExpectedPostgresColumn[];
}

interface ExpectedPostgresRelationship {
  foreign_key_name: string;
  schema: string;
  relation: string;
  columns: string[];
  is_one_to_one: boolean;
  referenced_schema: string;
  referenced_relation: string;
  referenced_columns: string[];
}

interface ExpectedPostgresPrimaryKey {
  schema: string;
  table_name: string;
  name: string;
  table_id: number;
}

interface ExpectedPostgresSchema {
  id: number;
  name: string;
  owner: string;
}

interface ExpectedPostgresTable {
  id: number;
  schema: string;
  name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  replica_identity: "DEFAULT" | "INDEX" | "FULL" | "NOTHING";
  bytes: number;
  size: string;
  live_rows_estimate: number;
  dead_rows_estimate: number;
  comment: string | null;
  columns?: ExpectedPostgresColumn[];
}

interface ExpectedPostgresType {
  id: number;
  name: string;
  schema: string;
  format: string;
  enums: string[];
  attributes: { name: string; type_id: number }[];
  comment: string | null;
  type_relation_id: number | null;
}

interface ExpectedPostgresView {
  id: number;
  schema: string;
  name: string;
  is_updatable: boolean;
  // Extensions over postgres-meta's original contract: trigger-aware
  // writability, added when porting supabase/postgres-meta#1062 into this
  // package. Optional so the addition stays truly additive: version 1
  // documents and postgres-meta's own view objects, which predate the
  // fields, remain valid.
  is_insert_enabled?: boolean;
  is_update_enabled?: boolean;
  comment: string | null;
  columns?: ExpectedPostgresColumn[];
}

interface ExpectedGeneratorMetadata {
  version: 1;
  schemas: ExpectedPostgresSchema[];
  tables: Omit<ExpectedPostgresTable, "columns">[];
  foreignTables: Omit<ExpectedPostgresForeignTable, "columns">[];
  views: Omit<ExpectedPostgresView, "columns">[];
  materializedViews: Omit<ExpectedPostgresMaterializedView, "columns">[];
  columns: ExpectedPostgresColumn[];
  primaryKeys: ExpectedPostgresPrimaryKey[];
  relationships: ExpectedPostgresRelationship[];
  functions: ExpectedPostgresFunction[];
  types: ExpectedPostgresType[];
}

assertEquals<Equals<PostgresColumn, ExpectedPostgresColumn>>();
assertEquals<Equals<PostgresForeignTable, ExpectedPostgresForeignTable>>();
assertEquals<Equals<PostgresFunction, ExpectedPostgresFunction>>();
assertEquals<
  Equals<PostgresMaterializedView, ExpectedPostgresMaterializedView>
>();
assertEquals<Equals<PostgresPrimaryKey, ExpectedPostgresPrimaryKey>>();
assertEquals<Equals<PostgresRelationship, ExpectedPostgresRelationship>>();
assertEquals<Equals<PostgresSchema, ExpectedPostgresSchema>>();
assertEquals<Equals<PostgresTable, ExpectedPostgresTable>>();
assertEquals<Equals<PostgresType, ExpectedPostgresType>>();
assertEquals<Equals<PostgresView, ExpectedPostgresView>>();
assertEquals<Equals<GeneratorMetadata, ExpectedGeneratorMetadata>>();

describe("parseGeneratorMetadata", () => {
  const validMetadata: GeneratorMetadata = buildMetadata({
    tables: [baseTable()],
    columns: [
      baseColumn({
        name: "id",
        format: "int8",
        is_identity: true,
        ordinal_position: 1,
      }),
      baseColumn({
        name: "status",
        format: "user_status",
        is_nullable: true,
        ordinal_position: 2,
      }),
    ],
    relationships: [baseRelationship()],
    functions: [
      baseFunction({
        name: "add",
        args: [{ mode: "in", name: "a", type_id: 23, has_default: false }],
      }),
    ],
    types: [userStatusEnum, textType, addressCompositeType],
  });

  test("returns the value unchanged when it satisfies the contract", () => {
    expect(parseGeneratorMetadata(validMetadata)).toEqual(validMetadata);
  });

  test("accepts a fully empty metadata", () => {
    const empty: GeneratorMetadata = {
      version: GENERATOR_METADATA_VERSION,
      schemas: [],
      tables: [],
      foreignTables: [],
      views: [],
      materializedViews: [],
      columns: [],
      primaryKeys: [],
      relationships: [],
      functions: [],
      types: [],
    };
    expect(parseGeneratorMetadata(empty)).toEqual(empty);
  });

  test("accepts views without the trigger-aware writability fields", () => {
    // Version 1 documents produced before is_insert_enabled and
    // is_update_enabled existed must keep validating.
    const legacy = {
      ...buildMetadata(),
      views: [
        {
          id: 16386,
          schema: "public",
          name: "tickets_view",
          is_updatable: true,
          comment: null,
        },
      ],
    };
    expect(parseGeneratorMetadata(legacy)).toEqual(legacy);
  });

  test("rejects a non-object", () => {
    expect(() => parseGeneratorMetadata(null)).toThrow(TypeError);
    expect(() => parseGeneratorMetadata("nope")).toThrow(
      "Invalid GeneratorMetadata",
    );
  });

  test("rejects a missing top-level collection", () => {
    const { types: _dropped, ...missingTypes } = validMetadata;
    expect(() => parseGeneratorMetadata(missingTypes)).toThrow(/types/);
  });

  test("rejects a column with a wrong field type", () => {
    const bad = {
      ...validMetadata,
      columns: [{ ...validMetadata.columns[0], is_nullable: "yes" }],
    };
    expect(() => parseGeneratorMetadata(bad)).toThrow(TypeError);
  });

  test("rejects an invalid enum value (identity_generation)", () => {
    const bad = {
      ...validMetadata,
      columns: [
        { ...validMetadata.columns[0], identity_generation: "SOMETIMES" },
      ],
    };
    expect(() => parseGeneratorMetadata(bad)).toThrow(TypeError);
  });

  test("rejects a relationship missing referenced_columns", () => {
    const { referenced_columns: _dropped, ...badRel } =
      validMetadata.relationships[0];
    const bad = { ...validMetadata, relationships: [badRel] };
    expect(() => parseGeneratorMetadata(bad)).toThrow(TypeError);
  });

  test("rejects a version mismatch", () => {
    const bad = { ...validMetadata, version: 2 };
    expect(() => parseGeneratorMetadata(bad)).toThrow(TypeError);
  });

  test("rejects a primary key missing table_id", () => {
    const { table_id: _dropped, ...badPrimaryKey } = {
      schema: "public",
      table_name: "tickets",
      name: "id",
      table_id: 1,
    };
    const bad = { ...validMetadata, primaryKeys: [badPrimaryKey] };
    expect(() => parseGeneratorMetadata(bad)).toThrow(TypeError);
  });

  test("accepts functions whose OUT/TABLE args have null has_default", () => {
    // `introspect()` emits `has_default: null` for the OUT columns of
    // RETURNS TABLE / OUT-arg functions: the introspection SQL sizes
    // `arg_has_defaults` from the input-arg count (`pronargs`) while
    // `arg_modes`/`arg_types` include the output args, so the trailing rows
    // get NULL. The validator must accept that real introspector output.
    const withNullHasDefault = buildMetadata({
      functions: [
        baseFunction({
          name: "function_returning_table",
          args: [
            { mode: "in", name: "user_id", type_id: 23, has_default: false },
            {
              mode: "table",
              name: "id",
              type_id: 23,
              has_default: null as unknown as boolean,
            },
          ],
        }),
      ],
    });
    expect(() => parseGeneratorMetadata(withNullHasDefault)).not.toThrow();
  });
});

describe("generatorMetadataSchema", () => {
  test("is exported for advanced/custom validation flows", () => {
    expect(typeof generatorMetadataSchema).toBe("function");
  });
});

describe("serializeGeneratorMetadata", () => {
  const validMetadata: GeneratorMetadata = buildMetadata({
    tables: [baseTable()],
    columns: [baseColumn({ name: "id" })],
  });

  test("round-trips through JSON without loss", () => {
    const json = serializeGeneratorMetadata(validMetadata);
    expect(JSON.parse(json)).toEqual(validMetadata);
  });

  test("produces a value parseGeneratorMetadata accepts unchanged", () => {
    const json = serializeGeneratorMetadata(validMetadata);
    expect(parseGeneratorMetadata(JSON.parse(json))).toEqual(validMetadata);
  });
});

describe("generatorMetadataJsonSchema", () => {
  test("is a JSON Schema object requiring every top-level collection", () => {
    const schema = generatorMetadataJsonSchema as {
      type: string;
      required: string[];
    };
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "version",
        "schemas",
        "tables",
        "primaryKeys",
        "relationships",
      ]),
    );
  });

  test("is itself JSON-serializable", () => {
    expect(() => JSON.stringify(generatorMetadataJsonSchema)).not.toThrow();
  });
});
