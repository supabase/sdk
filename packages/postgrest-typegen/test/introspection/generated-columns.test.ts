import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { Wait } from "testcontainers";

import { generateTypescript } from "../../src/generation/typescript.ts";
import { introspect } from "../../src/introspection/index.ts";
import { sortGeneratorMetadata } from "../../src/sort.ts";

/**
 * Integration coverage for generated columns against PostgreSQL 18, which
 * introduced virtual generated columns (`attgenerated = 'v'`) and made
 * VIRTUAL the default for `GENERATED ALWAYS AS (...)`. Neither stored nor
 * virtual generated columns accept writes, so both must introspect as
 * `is_generated` and emit `?: never` in Insert/Update while staying readable
 * in Row.
 */
let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withUsername("postgres")
    .withPassword("postgres")
    .withDatabase("postgres")
    .withWaitStrategy(Wait.forHealthCheck())
    .withStartupTimeout(120_000)
    .start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  await pool.query(/* SQL */ `
    create table measurement (
      id int primary key,
      height_cm numeric,
      height_in numeric generated always as (height_cm / 2.54) stored,
      height_mm numeric generated always as (height_cm * 10) virtual
    );
  `);
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe("generated columns (integration, PostgreSQL 18)", () => {
  test("stored and virtual generated columns are omitted from Insert and Update", async () => {
    const metadata = sortGeneratorMetadata(await introspect(pool));

    const generatedByName = Object.fromEntries(
      metadata.columns
        .filter((column) => column.table === "measurement")
        .map((column) => [column.name, column.is_generated]),
    );
    expect(generatedByName).toEqual({
      id: false,
      height_cm: false,
      height_in: true,
      height_mm: true,
    });

    const output = await generateTypescript(metadata);
    const section = (name: "Row" | "Insert" | "Update") => {
      const start = output.indexOf(`${name}: {`);
      return output.slice(start, output.indexOf("}", start));
    };
    expect(section("Row")).toContain("height_in: number | null");
    expect(section("Row")).toContain("height_mm: number | null");
    expect(section("Insert")).toContain("height_in?: never");
    expect(section("Insert")).toContain("height_mm?: never");
    expect(section("Update")).toContain("height_in?: never");
    expect(section("Update")).toContain("height_mm?: never");
  });
});
