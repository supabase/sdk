import { readFileSync } from "node:fs";
import { normalizeGriffe, type GriffeOutput } from "./normalize-griffe.js";

async function main(): Promise<void> {
  const [, , filePath, ...rest] = process.argv;
  if (!filePath) {
    console.error("Usage: normalize-griffe <api-raw.json> [--project-root <path>]");
    process.exit(1);
  }

  const rootIdx = rest.indexOf("--project-root");
  const projectRoot = rootIdx >= 0 ? rest[rootIdx + 1] : undefined;

  try {
    const raw: GriffeOutput = JSON.parse(readFileSync(filePath, "utf8"));
    const result = normalizeGriffe(raw, projectRoot);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
