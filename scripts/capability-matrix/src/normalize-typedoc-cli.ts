import { readFileSync, writeFileSync } from "node:fs";
import { normalize } from "./normalize-typedoc.js";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: normalize-typedoc <input.json> <output.json>");
  process.exit(1);
}

const json = JSON.parse(readFileSync(inputPath, "utf8"));
const result = normalize(json);
writeFileSync(outputPath, JSON.stringify(result, null, 2));
