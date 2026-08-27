/**
 * Prints this package's generated output for one language against a live
 * database, for the "parity vs. real postgres-meta" CI job to diff against
 * postgres-meta's own `npm run gen:types:<lang>` output for the same schema.
 * Not used by the test suite, which compares against committed goldens
 * instead — this is the live-vs-live check the goldens can't provide, since
 * they're maintained by regenerating from this package itself.
 *
 * Mirrors postgres-meta's `server.ts` CLI path: no generator options
 * overridden, matching its defaults when no `PG_META_GENERATE_TYPES_*` env
 * vars are set, and a single `console.log` so the trailing newline matches.
 *
 * Usage: bun scripts/print-generated.ts <typescript|go|python|swift>
 */
import { Pool } from "pg";

import {
  generateGo,
  generatePython,
  generateSwift,
  generateTypescript,
  introspect,
  sortGeneratorMetadata,
} from "../src/index.ts";

const language = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  const metadata = sortGeneratorMetadata(await introspect(pool));
  switch (language) {
    case "typescript":
      console.log(await generateTypescript(metadata));
      break;
    case "go":
      console.log(generateGo(metadata));
      break;
    case "python":
      console.log(generatePython(metadata));
      break;
    case "swift":
      console.log(generateSwift(metadata));
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
} finally {
  await pool.end();
}
