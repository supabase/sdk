/**
 * Writes postgrest-js's `test/types.generated.ts` from this checkout's
 * generator, with the options `supabase gen types typescript --local` uses.
 *
 * Usage: bun run generate:postgrest-js-types <database-url> <output-file>
 */
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { introspect } from "../src/introspection/index.ts";
import { generateTypescript } from "../src/generation/index.ts";
import { sortGeneratorMetadata } from "../src/sort.ts";

const [databaseUrl, outputFile] = process.argv.slice(2);
if (!databaseUrl || !outputFile) {
  console.error(
    "Usage: bun run generate:postgrest-js-types <database-url> <output-file>",
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const metadata = await introspect(pool, {
    includedSchemas: ["public", "personal"],
  });
  const types = await generateTypescript(sortGeneratorMetadata(metadata), {
    detectOneToOneRelationships: true,
    defaultSchema: "public",
    format: async (code) => code,
  });
  await writeFile(outputFile, types);
} finally {
  await pool.end();
}
