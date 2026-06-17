import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { normalizeSpec, findUnmatchedOverrides, type NormalizeOptions } from "./normalize";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function main(): void {
  const root = repoRoot();
  // Usage: tsx src/normalize-cli.ts <input> <output> <config>  (defaults target the Storage pilot)
  const argv = process.argv.slice(2);
  const input = resolve(root, argv[0] ?? "codegen/specs/storage.upstream.json");
  const output = resolve(root, argv[1] ?? "codegen/specs/storage.normalized.json");
  const configPath = resolve(root, argv[2] ?? "codegen/normalize/storage.json");

  const spec = JSON.parse(readFileSync(input, "utf8"));
  const options = JSON.parse(readFileSync(configPath, "utf8")) as NormalizeOptions;
  normalizeSpec(spec, options);
  const unmatched = [
    ...findUnmatchedOverrides(spec, options.operationIdOverrides ?? {}),
    ...findUnmatchedOverrides(spec, options.requestBodyInjections ?? {}),
  ];
  if (unmatched.length > 0) {
    throw new Error(`override/injection keys match no operation (check method + exact path, incl. trailing slash): ${unmatched.join(", ")}`);
  }
  writeFileSync(output, JSON.stringify(spec, null, 2) + "\n");
  console.log(`normalized ${input} -> ${output}`);
}

main();
