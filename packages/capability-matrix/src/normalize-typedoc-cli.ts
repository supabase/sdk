import { readFileSync, writeFileSync } from "node:fs";
import { mergeProjects } from "./normalize-typedoc.js";

// Usage:
//   normalize-typedoc <input.json> <output.json>          (single project)
//   normalize-typedoc --out <output.json> <input.json>... (merge N projects)
//
// The merge form concatenates the symbols of several TypeDoc project JSONs into
// one ParseResult — used for monorepos where each package is documented
// separately. TypeDoc emits repo-root-relative file paths, so no path rewriting
// is needed.

const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");

let inputs: string[];
let outputPath: string | undefined;

if (outIdx !== -1) {
  outputPath = argv[outIdx + 1];
  inputs = argv.filter((_, i) => i !== outIdx && i !== outIdx + 1);
} else {
  // Legacy single-project form: <input> <output>
  const [inputPath, legacyOut] = argv;
  inputs = inputPath ? [inputPath] : [];
  outputPath = legacyOut;
}

if (!outputPath || inputs.length === 0) {
  console.error(
    [
      "Usage:",
      "  normalize-typedoc <input.json> <output.json>",
      "  normalize-typedoc --out <output.json> <input.json>...",
    ].join("\n"),
  );
  process.exit(1);
}

const projects = inputs.map((path) => JSON.parse(readFileSync(path, "utf8")));
writeFileSync(outputPath, JSON.stringify(mergeProjects(projects), null, 2));
