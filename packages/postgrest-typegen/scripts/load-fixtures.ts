/**
 * Loads the shared fixture schema (the same one `test/introspection/` and
 * `test/parity/` use) into DATABASE_URL. Used by the "parity vs. real
 * postgres-meta" CI job so both sides introspect the identical schema
 * without depending on a system `psql` client being present on the runner.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const FIXTURE_DIR = join(
  import.meta.dir,
  "..",
  "test",
  "introspection",
  "fixtures",
);

const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query(readFileSync(join(FIXTURE_DIR, "00-init.sql"), "utf8"));
  await pool.query(readFileSync(join(FIXTURE_DIR, "01-memes.sql"), "utf8"));
} finally {
  await pool.end();
}
