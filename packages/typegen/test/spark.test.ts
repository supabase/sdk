import { describe, expect, test } from "bun:test";
import { parseGeneratorMetadata } from "@supabase/postgrest-typegen";
import {
  findLanguage,
  type SparkColumn,
  type SparkConstraint,
  type SparkSchemaDescription,
  type SparkTable,
  sparkGeneratorMetadata,
} from "../src/index.ts";

const column = (
  name: string,
  position: number,
  type: string,
  extra: Partial<SparkColumn> = {},
): SparkColumn => ({
  name,
  position,
  type,
  not_null: false,
  default: null,
  identity: null,
  generated: null,
  comment: null,
  ...extra,
});

const table = (
  name: string,
  columns: ReadonlyArray<SparkColumn>,
  constraints: ReadonlyArray<SparkConstraint> = [],
  schema = "public",
): SparkTable => ({
  schema,
  name,
  rls_enabled: true,
  rls_forced: false,
  comment: null,
  columns,
  constraints,
});

const primaryKey = (name: string, col: string): SparkConstraint => ({
  name,
  type: "p",
  def: `PRIMARY KEY (${col})`,
  columns: [col],
  references: null,
});

const foreignKey = (
  name: string,
  col: string,
  references: NonNullable<SparkConstraint["references"]>,
): SparkConstraint => ({
  name,
  type: "f",
  def: `FOREIGN KEY (${col}) REFERENCES ${references.table}(${references.columns.join(", ")})`,
  columns: [col],
  references,
});

const toAuthors = { schema: "public", table: "authors", columns: ["id"] };

const description: SparkSchemaDescription = {
  managed_schemas: ["auth"],
  schemas: [
    { name: "public", comment: null },
    { name: "private", comment: "not exposed" },
  ],
  enums: [
    {
      schema: "public",
      name: "status",
      labels: ["open", "done"],
      comment: null,
    },
    { schema: "private", name: "mood", labels: ["happy"], comment: null },
  ],
  tables: [
    table(
      "authors",
      [
        column("id", 1, "bigint", { not_null: true, identity: "a" }),
        column("name", 2, "text"),
        column("email", 3, "text", { not_null: true }),
      ],
      [
        primaryKey("authors_pkey", "id"),
        {
          name: "authors_email_key",
          type: "u",
          def: "UNIQUE (email)",
          columns: ["email"],
          references: null,
        },
      ],
    ),
    table(
      "profiles",
      [column("author_id", 1, "bigint", { not_null: true })],
      [
        primaryKey("profiles_pkey", "author_id"),
        foreignKey("profiles_author_id_fkey", "author_id", toAuthors),
      ],
    ),
    table(
      "posts",
      [
        column("id", 1, "integer", { not_null: true, identity: "d" }),
        column("author_id", 2, "bigint", { not_null: true }),
        column("status", 3, "status", {
          not_null: true,
          default: "'open'::status",
        }),
        column("tags", 4, "text[]"),
        column("matrix", 5, "integer[][]"),
        column("title", 6, "character varying(40)", {
          not_null: true,
          default: "''::text",
        }),
        column("done_at", 7, "timestamp with time zone"),
        column("slug", 8, "text", { generated: "lower(title)" }),
        column("score", 9, "integer", { comment: "0 to 10" }),
        column("flags", 10, "status[]"),
      ],
      [
        primaryKey("posts_pkey", "id"),
        foreignKey("posts_author_id_fkey", "author_id", toAuthors),
        {
          name: "posts_score_check",
          type: "c",
          def: "CHECK ((score >= 0))",
          columns: ["score"],
          references: null,
        },
      ],
    ),
    table(
      "secrets",
      [
        column("id", 1, "uuid", { not_null: true }),
        column("mood", 2, "private.mood"),
      ],
      [],
      "private",
    ),
    table(
      "notes",
      [column("author_id", 1, "bigint")],
      [foreignKey("notes_author_id_fkey", "author_id", toAuthors)],
      "private",
    ),
    table(
      "users",
      [column("id", 1, "uuid", { not_null: true })],
      [primaryKey("users_pkey", "id")],
      "auth",
    ),
  ],
  views: [
    { schema: "public", name: "open_posts", comment: "only open" },
    { schema: "private", name: "all_secrets", comment: null },
  ],
};

const generate = async (schemas: ReadonlyArray<string>) => {
  const metadata = sparkGeneratorMetadata(description, { schemas });
  const code = await findLanguage("typescript")!.generate(
    metadata,
    {},
    {
      cwd: ".",
      env: {},
      format: (source) => Promise.resolve(source),
    },
  );
  return code.replace(/\s+/gu, " ");
};

describe("sparkGeneratorMetadata", () => {
  test("produces a document the contract accepts", () => {
    const metadata = sparkGeneratorMetadata(description, {
      schemas: ["public", "private"],
    });
    expect(() => parseGeneratorMetadata(metadata)).not.toThrow();
  });

  test("keeps only the requested schemas, plus the always-present public", () => {
    const metadata = sparkGeneratorMetadata(description, {
      schemas: ["public", "auth"],
    });
    expect(metadata.schemas.map((s) => [s.name, s.owner])).toEqual([
      ["public", "postgres"],
      ["auth", "supabase_admin"],
    ]);
    expect(metadata.tables.map((t) => `${t.schema}.${t.name}`)).toEqual([
      "public.authors",
      "public.profiles",
      "public.posts",
      "auth.users",
    ]);
    expect(metadata.views.map((v) => v.name)).toEqual(["open_posts"]);
  });

  test("gives the same relation the same id everywhere", () => {
    const metadata = sparkGeneratorMetadata(description, {
      schemas: ["public"],
    });
    const posts = metadata.tables.find((t) => t.name === "posts")!;
    expect(posts.id).toBe(
      sparkGeneratorMetadata(description, { schemas: ["public"] }).tables[2]!
        .id,
    );
    expect(
      metadata.columns
        .filter((c) => c.table === "posts")
        .every((c) => c.table_id === posts.id),
    ).toBe(true);
    expect(
      metadata.primaryKeys.find((k) => k.table_name === "posts")?.table_id,
    ).toBe(posts.id);
  });

  test("maps column attributes", () => {
    const columns = sparkGeneratorMetadata(description, {
      schemas: ["public"],
    }).columns;
    const col = (table: string, name: string) =>
      columns.find((c) => c.table === table && c.name === name)!;

    expect(col("authors", "id")).toMatchObject({
      is_identity: true,
      identity_generation: "ALWAYS",
      default_value: null,
      is_nullable: false,
      format: "int8",
      type_schema: "pg_catalog",
    });
    expect(col("posts", "id")).toMatchObject({
      is_identity: true,
      identity_generation: "BY DEFAULT",
    });
    expect(col("authors", "email").is_unique).toBe(true);
    expect(col("authors", "name")).toMatchObject({
      is_nullable: true,
      is_unique: false,
    });
    expect(col("posts", "status")).toMatchObject({
      default_value: "'open'::status",
      data_type: "USER-DEFINED",
      format: "status",
      type_schema: "public",
      enums: ["open", "done"],
    });
    expect(col("posts", "slug").is_generated).toBe(true);
    expect(col("posts", "score")).toMatchObject({
      check: "(score >= 0)",
      comment: "0 to 10",
    });
    expect(col("posts", "title")).toMatchObject({
      data_type: "character varying",
      format: "varchar",
    });
    expect(col("posts", "done_at").format).toBe("timestamptz");
  });

  test("names array types after their element whatever the dimensions", () => {
    const columns = sparkGeneratorMetadata(description, {
      schemas: ["public"],
    }).columns;
    const col = (name: string) =>
      columns.find((c) => c.table === "posts" && c.name === name)!;
    expect(col("tags")).toMatchObject({ data_type: "ARRAY", format: "_text" });
    expect(col("matrix")).toMatchObject({
      data_type: "ARRAY",
      format: "_int4",
    });
    expect(col("flags")).toMatchObject({
      data_type: "ARRAY",
      format: "_status",
      type_schema: "public",
      enums: ["open", "done"],
    });
  });

  test("resolves an enum written with its schema", () => {
    const metadata = sparkGeneratorMetadata(description, {
      schemas: ["private"],
    });
    expect(metadata.columns.find((c) => c.name === "mood")).toMatchObject({
      format: "mood",
      type_schema: "private",
      enums: ["happy"],
    });
    expect(metadata.types.find((t) => t.name === "mood")?.format).toBe(
      "private.mood",
    );
    expect(metadata.types.find((t) => t.name === "status")?.format).toBe(
      "status",
    );
  });

  test("detects one-to-one foreign keys through a primary key or unique constraint", () => {
    const relationships = sparkGeneratorMetadata(description, {
      schemas: ["public"],
    }).relationships;
    expect(
      relationships.map((r) => [r.foreign_key_name, r.is_one_to_one]),
    ).toEqual([
      ["profiles_author_id_fkey", true],
      ["posts_author_id_fkey", false],
    ]);
    expect(relationships[0]).toMatchObject({
      schema: "public",
      relation: "profiles",
      columns: ["author_id"],
      referenced_schema: "public",
      referenced_relation: "authors",
      referenced_columns: ["id"],
    });
  });

  test("drops a foreign key whose target schema is not requested", () => {
    const metadata = sparkGeneratorMetadata(
      {
        ...description,
        tables: [
          table(
            "orders",
            [column("user_id", 1, "uuid")],
            [
              foreignKey("orders_user_id_fkey", "user_id", {
                schema: "auth",
                table: "users",
                columns: ["id"],
              }),
            ],
          ),
        ],
      },
      { schemas: ["public"] },
    );
    expect(metadata.relationships).toEqual([]);
    expect(
      sparkGeneratorMetadata(
        {
          ...description,
          tables: [
            table(
              "orders",
              [column("user_id", 1, "uuid")],
              [
                foreignKey("orders_user_id_fkey", "user_id", {
                  schema: "auth",
                  table: "users",
                  columns: ["id"],
                }),
              ],
            ),
          ],
        },
        { schemas: ["public", "auth"] },
      ).relationships,
    ).toHaveLength(1);
  });

  test("keeps a foreign key from a requested table into another requested schema, not the reverse", () => {
    const relationships = sparkGeneratorMetadata(description, {
      schemas: ["public", "private"],
    }).relationships;
    expect(relationships.map((r) => `${r.schema}.${r.relation}`)).toContain(
      "private.notes",
    );
    expect(
      sparkGeneratorMetadata(description, { schemas: ["private"] })
        .relationships,
    ).toEqual([]);
  });

  test("has no functions, composite types or view columns", () => {
    const metadata = sparkGeneratorMetadata(description, {
      schemas: ["public"],
    });
    expect(metadata.functions).toEqual([]);
    expect(metadata.rpcFunctions).toEqual([]);
    expect(metadata.materializedViews).toEqual([]);
    expect(metadata.foreignTables).toEqual([]);
    expect(metadata.types.every((t) => t.attributes.length === 0)).toBe(true);
    expect(metadata.views[0]).toMatchObject({
      name: "open_posts",
      is_updatable: false,
      comment: "only open",
    });
  });
});

describe("sparkGeneratorMetadata through the typescript generator", () => {
  test("renders tables, enums, identity, defaults and arrays", async () => {
    const types = await generate(["public"]);

    expect(types).toContain(
      'Insert: { "email": string,"id"?: never,"name"?: string | null }',
    );
    expect(types).toContain(
      '"author_id": number,"done_at": string | null,"flags": (Database["public"][\'Enums\']["status"])[] | null,"id": number,"matrix": (number)[] | null,"score": number | null,"slug": string | null,"status": Database["public"][\'Enums\']["status"],"tags": (string)[] | null,"title": string',
    );
    expect(types).toContain(
      '"status"?: Database["public"][\'Enums\']["status"]',
    );
    expect(types).toContain('"status": "open"|"done"');
    expect(types).toContain("export const Constants");
  });

  test("renders relationships with one-to-one detection", async () => {
    const types = await generate(["public"]);
    expect(types).toContain(
      'foreignKeyName: "profiles_author_id_fkey" columns: ["author_id"] isOneToOne: true',
    );
    expect(types).toContain(
      'foreignKeyName: "posts_author_id_fkey" columns: ["author_id"] isOneToOne: false',
    );
  });

  test("renders views without columns", async () => {
    expect(await generate(["public"])).toContain(
      'Views: { "open_posts": { Row: { }',
    );
  });

  test("renders only the requested schemas", async () => {
    const publicOnly = await generate(["public"]);
    expect(publicOnly).not.toContain('"private": {');
    expect(publicOnly).not.toContain('"secrets"');

    const both = await generate(["public", "private"]);
    expect(both).toContain('"private": {');
    expect(both).toContain('"secrets"');
    expect(both).toContain('"mood": "happy"');
    expect(both).toContain('"public": {');
  });
});
