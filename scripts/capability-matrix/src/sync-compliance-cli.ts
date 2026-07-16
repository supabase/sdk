import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { loadAreas } from "./load.js";
import { collectFeatureIds, findMissingFeatureIds } from "./compliance.js";
import type { RawCompliance } from "./compliance.js";
import { buildSourceMap } from "./compliance-source-map.js";

// Inserts canonical capability IDs that are missing from an SDK's
// sdk-compliance.yaml as `not_implemented`. Canonical IDs and compliance keys
// share the `area.group.feature` shape, so each new ID is placed next to its
// existing siblings (same `area.group.` prefix); an ID whose group has no local
// sibling yet is appended under a comment for manual placement. Editing the raw
// text (rather than re-serializing the parsed document) keeps the file's
// comments and formatting intact.

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function parseArguments(argv: string[]): { compliancePath: string; newIdsOutput: string } {
  let compliancePath: string | undefined;
  let newIdsOutput = "new_ids.txt";
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--new-ids-output") {
      newIdsOutput = argv[++index];
    } else if (!argument.startsWith("--") && compliancePath === undefined) {
      compliancePath = argument;
    }
  }
  if (!compliancePath) {
    console.error(
      "Usage: sync-compliance-cli.ts <path-to-sdk-compliance.yaml> [--new-ids-output <path>]",
    );
    process.exit(1);
  }
  return { compliancePath, newIdsOutput };
}

function blockEnd(lines: string[], start: number): number {
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith("    ")) end++;
  return end;
}

async function main(): Promise<void> {
  const { compliancePath, newIdsOutput } = parseArguments(process.argv.slice(2));

  const { areas, findings } = loadAreas(join(repoRoot(), "capabilities"));
  if (findings.some((finding) => finding.level === "error")) {
    console.error("Failed to load canonical capability spec — check this repo's capabilities/*.yaml");
    process.exit(1);
  }
  const knownIds = collectFeatureIds(areas);

  const text = readFileSync(resolve(compliancePath), "utf8");
  let raw: RawCompliance;
  try {
    raw = parse(text) as RawCompliance;
  } catch (error) {
    console.error(`YAML parse error: ${(error as Error).message}`);
    process.exit(1);
  }

  const missing = findMissingFeatureIds(raw, knownIds);
  writeFileSync(resolve(newIdsOutput), missing.length ? missing.join("\n") + "\n" : "");
  if (missing.length === 0) {
    console.log("No new capability IDs.");
    return;
  }

  const { featureLines } = buildSourceMap(text);
  const existing = [...featureLines.entries()];

  const hadTrailingNewline = text.endsWith("\n");
  const lines = text.split("\n");
  if (hadTrailingNewline) lines.pop();

  const byPrefix = new Map<string, string[]>();
  for (const id of missing) {
    const prefix = id.slice(0, id.lastIndexOf(".") + 1);
    const bucket = byPrefix.get(prefix);
    if (bucket) bucket.push(id);
    else byPrefix.set(prefix, [id]);
  }

  const insertions: { index: number; newLines: string[] }[] = [];
  const orphans: string[] = [];
  for (const [prefix, ids] of byPrefix) {
    const siblingLines = existing
      .filter(([existingId]) => existingId.startsWith(prefix))
      .map(([, line]) => line);
    if (siblingLines.length === 0) {
      orphans.push(...ids);
      continue;
    }
    const lastKeyIndex = Math.max(...siblingLines) - 1;
    insertions.push({
      index: blockEnd(lines, lastKeyIndex),
      newLines: ids.map((id) => `  ${id}: not_implemented`),
    });
  }

  for (const { index, newLines } of insertions.sort((a, b) => b.index - a.index)) {
    lines.splice(index, 0, ...newLines);
  }

  if (orphans.length > 0) {
    lines.push("", "  # Newly synced from the canonical spec; no local group yet, place manually.");
    for (const id of orphans) lines.push(`  ${id}: not_implemented`);
  }

  writeFileSync(resolve(compliancePath), lines.join("\n") + "\n");
  console.log(
    `Added ${missing.length} new capability IDs (${orphans.length} without an existing group).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
