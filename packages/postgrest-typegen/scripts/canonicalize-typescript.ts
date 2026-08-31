/**
 * Reformats a TypeScript file through this package's default formatter
 * (oxfmt, `semi: false`, `printWidth: 80`) and prints the result to stdout.
 *
 * Used by the "parity vs. real postgres-meta" CI job to canonicalize
 * postgres-meta's prettier-formatted output before diffing it against ours,
 * so a formatter-only difference (e.g. line-wrap heuristics) doesn't read as
 * a content divergence. Content itself still fails the diff either way.
 *
 * Usage: bun scripts/canonicalize-typescript.ts <file>
 */
import { readFileSync } from "node:fs";
import { format } from "oxfmt";

const filePath = process.argv[2];
if (!filePath) {
  throw new Error("A file path is required");
}

const { code, errors } = await format(
  "output.ts",
  readFileSync(filePath, "utf8"),
  {
    semi: false,
    printWidth: 80,
  },
);
if (errors.length > 0) {
  throw new Error(
    `oxfmt failed to format ${filePath}: ${errors.map((error) => error.message).join("; ")}`,
  );
}
process.stdout.write(code);
