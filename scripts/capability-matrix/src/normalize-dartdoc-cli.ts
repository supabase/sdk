import { readFileSync } from "node:fs";
import { normalizeDartdoc } from "./normalize-dartdoc.js";
import type { DartdocUnit } from "./normalize-dartdoc.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: normalize-dartdoc <path-to-merged-dartdoc-json>");
  process.exit(1);
}

try {
  const raw: DartdocUnit[] = JSON.parse(readFileSync(filePath, "utf8"));
  const result = normalizeDartdoc(raw);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
}
