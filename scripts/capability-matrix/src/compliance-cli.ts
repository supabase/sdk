import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { loadAreas } from "./load.js";
import { validateCompliance, collectFeatureIds } from "./compliance.js";
import type { RawCompliance } from "./compliance.js";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: compliance-cli.ts <path-to-sdk-compliance.yaml>");
    process.exit(1);
  }

  const root = repoRoot();
  const { areas, findings: loadFindings } = loadAreas(join(root, "capabilities"));
  if (loadFindings.some((f) => f.level === "error")) {
    console.error("Failed to load canonical capability spec — check this repo's capabilities/*.yaml");
    process.exit(1);
  }

  const knownIds = collectFeatureIds(areas);

  let raw: RawCompliance;
  try {
    raw = parse(readFileSync(resolve(filePath), "utf8")) as RawCompliance;
  } catch (e) {
    console.error(`YAML parse error: ${(e as Error).message}`);
    process.exit(1);
  }

  const findings = validateCompliance(raw, knownIds);
  for (const f of findings) {
    console.error(`ERROR ${f.message}`);
  }

  if (findings.length > 0) {
    console.error(`\n${findings.length} error(s) found.`);
    process.exit(1);
  }
  console.log("OK — compliance file is valid.");
}

main().catch((e) => { console.error(e); process.exit(1); });
