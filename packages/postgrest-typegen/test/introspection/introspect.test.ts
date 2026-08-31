import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { Wait } from "testcontainers";

import { introspect } from "../../src/introspection/index.ts";
import { parseGeneratorMetadata } from "../../src/types.ts";
import type { GeneratorMetadata } from "../../src/types.ts";

/**
 * Integration coverage for `introspect()` against a real Postgres container,
 * using the same `00-init.sql` / `01-memes.sql` fixtures as postgres-meta.
 *
 * `pg.Pool` is passed directly as the `Queryable` — it satisfies the structural
 * interface and returns int8 columns as strings, exercising `normalize.ts`.
 */
const FIXTURE_DIR = join(import.meta.dir, "fixtures");
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

let container: StartedPostgreSqlContainer;
let pool: Pool;
let full: GeneratorMetadata;
let onlyPublic: GeneratorMetadata;
let excludingPublic: GeneratorMetadata;

beforeAll(async () => {
  // The fixtures reference the `postgres` superuser role, so match it (the
  // testcontainers default is `test`).
  container = await new PostgreSqlContainer("postgres:15-alpine")
    .withUsername("postgres")
    .withPassword("postgres")
    .withDatabase("postgres")
    .withWaitStrategy(Wait.forHealthCheck())
    .withStartupTimeout(120_000)
    .start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  await pool.query(readFileSync(join(FIXTURE_DIR, "00-init.sql"), "utf8"));
  await pool.query(readFileSync(join(FIXTURE_DIR, "01-memes.sql"), "utf8"));

  full = await introspect(pool);
  onlyPublic = await introspect(pool, { includedSchemas: ["public"] });
  excludingPublic = await introspect(pool, { excludedSchemas: ["public"] });
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

const findTable = (m: GeneratorMetadata, name: string) =>
  m.tables.find((t) => t.schema === "public" && t.name === name);

describe("introspect (integration)", () => {
  test("returns the public schema and excludes system schemas", () => {
    const names = full.schemas.map((s) => s.name);
    expect(names).toContain("public");
    expect(names).not.toContain("pg_catalog");
    expect(names).not.toContain("information_schema");
  });

  test("normalizes int8 ids to numbers while leaving composite column ids as strings", () => {
    const users = findTable(full, "users");
    expect(users).toBeDefined();
    expect(typeof users!.id).toBe("number");

    const idColumn = full.columns.find(
      (c) => c.table_id === users!.id && c.name === "id",
    );
    expect(idColumn).toBeDefined();
    // table_id is int8 → number; the column's composite id stays a "<oid>.<attnum>" string
    expect(typeof idColumn!.table_id).toBe("number");
    expect(typeof idColumn!.id).toBe("string");
    expect(idColumn!.id).toContain(".");
  });

  test("users columns introspect with expected formats/flags", () => {
    const users = findTable(full, "users")!;
    const cols = full.columns
      .filter((c) => c.table_id === users.id)
      .sort(byName)
      .map((c) => ({
        name: c.name,
        format: c.format,
        type_schema: c.type_schema,
        is_nullable: c.is_nullable,
        is_identity: c.is_identity,
      }));

    expect(cols).toMatchInlineSnapshot(`
      [
        {
          "format": "numeric",
          "is_identity": false,
          "is_nullable": true,
          "name": "decimal",
          "type_schema": "pg_catalog",
        },
        {
          "format": "int8",
          "is_identity": true,
          "is_nullable": false,
          "name": "id",
          "type_schema": "pg_catalog",
        },
        {
          "format": "text",
          "is_identity": false,
          "is_nullable": true,
          "name": "name",
          "type_schema": "pg_catalog",
        },
        {
          "format": "user_status",
          "is_identity": false,
          "is_nullable": true,
          "name": "status",
          "type_schema": "public",
        },
        {
          "format": "uuid",
          "is_identity": false,
          "is_nullable": true,
          "name": "user_uuid",
          "type_schema": "pg_catalog",
        },
      ]
    `);
  });

  describe("primary keys", () => {
    test("single-column primary key (users.id)", () => {
      const users = findTable(full, "users")!;
      const pks = full.primaryKeys
        .filter((pk) => pk.table_id === users.id)
        .map((pk) => pk.name);
      expect(pks).toEqual(["id"]);
    });

    test("every primary key entry resolves to a real table id", () => {
      const tableIds = new Set(full.tables.map((t) => t.id));
      expect(full.primaryKeys.every((pk) => tableIds.has(pk.table_id))).toBe(
        true,
      );
    });

    test("excludedSchemas drops the named schema's primary keys", () => {
      expect(
        excludingPublic.primaryKeys.every((pk) => pk.schema !== "public"),
      ).toBe(true);
    });
  });

  test("excludes trigger and event_trigger functions", () => {
    expect(full.functions.some((f) => f.return_type === "trigger")).toBe(false);
    expect(full.functions.some((f) => f.return_type === "event_trigger")).toBe(
      false,
    );
    // the plain `add(integer, integer)` SQL function from 00-init survives
    expect(
      full.functions.some((f) => f.schema === "public" && f.name === "add"),
    ).toBe(true);
  });

  test("includes composite and enum types", () => {
    expect(
      full.types.some(
        (t) =>
          t.schema === "public" &&
          t.name === "user_status" &&
          t.enums.length > 0,
      ),
    ).toBe(true);
    expect(
      full.types.some(
        (t) =>
          t.name === "composite_type_with_array_attribute" &&
          t.attributes.length > 0,
      ),
    ).toBe(true);
  });

  describe("relationships", () => {
    const has = (
      m: GeneratorMetadata,
      relation: string,
      referenced: string,
    ): boolean =>
      m.relationships.some(
        (r) =>
          r.schema === "public" &&
          r.relation === relation &&
          r.referenced_schema === "public" &&
          r.referenced_relation === referenced,
      );

    test("table→table foreign key (todos → users)", () => {
      expect(has(full, "todos", "users")).toBe(true);
    });

    test("view→table expansion (todos_view → users)", () => {
      expect(has(full, "todos_view", "users")).toBe(true);
    });

    test("table→view expansion (todos → users_view)", () => {
      expect(has(full, "todos", "users_view")).toBe(true);
    });

    test("view→view expansion (todos_view → users_view)", () => {
      expect(has(full, "todos_view", "users_view")).toBe(true);
    });
  });

  describe("parseGeneratorMetadata round-trips real introspection output", () => {
    test("RETURNS TABLE functions emit null has_default for their OUT columns", () => {
      const fn = full.functions.find(
        (f) => f.schema === "public" && f.name === "function_returning_table",
      );
      expect(fn).toBeDefined();
      const tableArgs = fn!.args.filter((a) => a.mode === "table");
      expect(tableArgs.length).toBeGreaterThan(0);
      expect(tableArgs.every((a) => a.has_default === null)).toBe(true);
    });

    test("validates without throwing", () => {
      expect(() => parseGeneratorMetadata(full)).not.toThrow();
    });
  });

  describe("view writability flags", () => {
    test("auto-updatable views enable both insert and update", () => {
      const view = full.views.find(
        (candidate) =>
          candidate.schema === "public" && candidate.name === "todos_view",
      );
      expect(view?.is_updatable).toBe(true);
      expect(view?.is_insert_enabled).toBe(true);
      expect(view?.is_update_enabled).toBe(true);
    });

    test("INSTEAD OF triggers and rules enable insert and update independently", async () => {
      // A join view is not auto-updatable; INSTEAD OF triggers and
      // unconditional INSTEAD rules make individual write events work, and
      // the affected views' columns must stay writable rather than degrading
      // to non-updatable. Conditional rules do not make a view writable.
      await pool.query(/* SQL */ `
        create schema instead_of_trigger_test;
        create table instead_of_trigger_test.profile (
          id int primary key,
          username text
        );
        create table instead_of_trigger_test.profile_type (
          id int primary key,
          name text
        );
        create function instead_of_trigger_test.noop_trigger()
        returns trigger
        language plpgsql
        as $$
        begin
          return new;
        end;
        $$;

        create view instead_of_trigger_test.insert_trigger_view as
          select p.id, p.username, pt.name
          from instead_of_trigger_test.profile p
          join instead_of_trigger_test.profile_type pt on pt.id = p.id;
        create trigger insert_trigger
          instead of insert on instead_of_trigger_test.insert_trigger_view
          for each row
          execute function instead_of_trigger_test.noop_trigger();

        create view instead_of_trigger_test.update_trigger_view as
          select p.id, p.username, pt.name
          from instead_of_trigger_test.profile p
          join instead_of_trigger_test.profile_type pt on pt.id = p.id;
        create trigger update_trigger
          instead of update on instead_of_trigger_test.update_trigger_view
          for each row
          execute function instead_of_trigger_test.noop_trigger();

        create view instead_of_trigger_test.both_triggers_view as
          select p.id, p.username, pt.name
          from instead_of_trigger_test.profile p
          join instead_of_trigger_test.profile_type pt on pt.id = p.id;
        create trigger both_insert_trigger
          instead of insert on instead_of_trigger_test.both_triggers_view
          for each row
          execute function instead_of_trigger_test.noop_trigger();
        create trigger both_update_trigger
          instead of update on instead_of_trigger_test.both_triggers_view
          for each row
          execute function instead_of_trigger_test.noop_trigger();

        create view instead_of_trigger_test.insert_rule_view as
          select p.id, p.username, pt.name
          from instead_of_trigger_test.profile p
          join instead_of_trigger_test.profile_type pt on pt.id = p.id;
        create rule insert_rule as
          on insert to instead_of_trigger_test.insert_rule_view do instead
          insert into instead_of_trigger_test.profile (id, username)
          values (new.id, new.username);

        create view instead_of_trigger_test.conditional_rule_view as
          select p.id, p.username, pt.name
          from instead_of_trigger_test.profile p
          join instead_of_trigger_test.profile_type pt on pt.id = p.id;
        create rule conditional_rule as
          on update to instead_of_trigger_test.conditional_rule_view
          where new.id > 0 do instead nothing;

        create view instead_of_trigger_test.read_only_view as
          select p.id, p.username, pt.name
          from instead_of_trigger_test.profile p
          join instead_of_trigger_test.profile_type pt on pt.id = p.id;
      `);
      try {
        const metadata = await introspect(pool, {
          includedSchemas: ["instead_of_trigger_test"],
        });
        const expectations: Record<
          string,
          {
            insertEnabled: boolean;
            updateEnabled: boolean;
            columnsUpdatable: boolean;
          }
        > = {
          insert_trigger_view: {
            insertEnabled: true,
            updateEnabled: false,
            columnsUpdatable: true,
          },
          update_trigger_view: {
            insertEnabled: false,
            updateEnabled: true,
            columnsUpdatable: true,
          },
          both_triggers_view: {
            insertEnabled: true,
            updateEnabled: true,
            columnsUpdatable: true,
          },
          insert_rule_view: {
            insertEnabled: true,
            updateEnabled: false,
            columnsUpdatable: true,
          },
          conditional_rule_view: {
            insertEnabled: false,
            updateEnabled: false,
            columnsUpdatable: false,
          },
          read_only_view: {
            insertEnabled: false,
            updateEnabled: false,
            columnsUpdatable: false,
          },
        };
        for (const [viewName, expected] of Object.entries(expectations)) {
          const view = metadata.views.find(
            (candidate) => candidate.name === viewName,
          );
          expect(view?.is_updatable, viewName).toBe(false);
          expect(view?.is_insert_enabled, viewName).toBe(
            expected.insertEnabled,
          );
          expect(view?.is_update_enabled, viewName).toBe(
            expected.updateEnabled,
          );
          const viewColumns = metadata.columns.filter(
            (column) => column.table === viewName,
          );
          expect(viewColumns.length, viewName).toBe(3);
          expect(
            viewColumns.every(
              (column) => column.is_updatable === expected.columnsUpdatable,
            ),
            viewName,
          ).toBe(true);
        }
      } finally {
        await pool.query("drop schema instead_of_trigger_test cascade");
      }
    });
  });

  describe("schema filters", () => {
    test("includedSchemas restricts to the named schema", () => {
      expect(onlyPublic.schemas.every((s) => s.name === "public")).toBe(true);
      expect(findTable(onlyPublic, "users")).toBeDefined();
    });

    test("excludedSchemas drops the named schema's objects", () => {
      expect(excludingPublic.schemas.some((s) => s.name === "public")).toBe(
        false,
      );
      expect(excludingPublic.tables.every((t) => t.schema !== "public")).toBe(
        true,
      );
      expect(excludingPublic.columns.every((c) => c.schema !== "public")).toBe(
        true,
      );
    });
  });
});
