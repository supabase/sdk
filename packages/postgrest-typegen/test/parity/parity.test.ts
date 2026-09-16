import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { Wait } from "testcontainers";

import {
  generateGo,
  generatePython,
  generateSwift,
  generateTypescript,
  sortGeneratorMetadata,
} from "../../src/generation/index.ts";
import { introspect } from "../../src/introspection/index.ts";
import type { GeneratorMetadata } from "../../src/types.ts";

/**
 * End-to-end golden gate: introspect the shared fixture DB, run all four
 * generators with their default options, and assert the output matches the
 * committed golden files in `expected/`.
 *
 * The metadata is passed through `sortGeneratorMetadata` first (as every
 * consumer must), so the golden files reflect the canonical, deterministic
 * ordering rather than the database's heap order. Consumers print the
 * generator's return value with `console.log`, which appends exactly one
 * trailing newline, hence the `+ "\n"` below.
 *
 * The goldens were originally captured from postgres-meta's own templates
 * before it cut over to this package; since then they are regenerated from
 * this package whenever a generator changes on purpose. A generator change
 * and its golden update land in the same PR, so this gate proves output does
 * not change *unintentionally*, and the reviewed golden diff is where an
 * intentional change gets scrutinized.
 */
const FIXTURE_DIR = join(import.meta.dir, "..", "introspection", "fixtures");
const EXPECTED_DIR = join(import.meta.dir, "expected");
const golden = (name: string) => readFileSync(join(EXPECTED_DIR, name), "utf8");

let container: StartedPostgreSqlContainer;
let pool: Pool;
let metadata: GeneratorMetadata;

beforeAll(async () => {
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
  metadata = sortGeneratorMetadata(await introspect(pool));
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe("generator parity vs postgres-meta CLI", () => {
  test("typescript", async () => {
    expect((await generateTypescript(metadata)) + "\n").toBe(
      golden("typescript.txt"),
    );
  });

  test("go", () => {
    expect(generateGo(metadata) + "\n").toBe(golden("go.txt"));
  });

  test("python", () => {
    expect(generatePython(metadata) + "\n").toBe(golden("python.txt"));
  });

  test("swift", () => {
    expect(generateSwift(metadata) + "\n").toBe(golden("swift.txt"));
  });
});
