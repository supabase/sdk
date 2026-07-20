import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parseDocument, isMap, isScalar } from "yaml";
import { loadAreas } from "./load.js";
import { collectFeatureIds, findMissingFeatureIds } from "./compliance.js";
import type { RawCompliance } from "./compliance.js";

// Inserts canonical capability IDs that are missing from an SDK's
// sdk-compliance.yaml as `not_implemented`. Canonical IDs and compliance keys
// share the `area.group.feature` shape, so each new ID is placed next to its
// existing siblings (same `area.group.` prefix); an ID whose group has no local
// sibling yet is appended under a comment for manual placement.
//
// Entries are added to the parsed YAML document and re-serialized with the yaml
// writer, so the output is always valid YAML regardless of the source layout.
// Re-serializing may collapse hand-wrapped `note:` scalars onto a single line.
// That is fine; the only concern here is keeping the file valid.

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function parseArguments(argv: string[]): {
  compliancePath: string;
  newIdsOutput: string;
} {
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

function main(): void {
  const { compliancePath, newIdsOutput } = parseArguments(
    process.argv.slice(2),
  );

  const { areas, findings } = loadAreas(join(repoRoot(), "capabilities"));
  if (findings.some((finding) => finding.level === "error")) {
    console.error(
      "Failed to load canonical capability spec — check this repo's capabilities/*.yaml",
    );
    process.exit(1);
  }
  const knownIds = collectFeatureIds(areas);

  const text = readFileSync(resolve(compliancePath), "utf8");
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    console.error(`YAML parse error: ${doc.errors[0].message}`);
    process.exit(1);
  }
  const raw = doc.toJS() as RawCompliance;

  const missing = findMissingFeatureIds(raw, knownIds);
  writeFileSync(
    resolve(newIdsOutput),
    missing.length ? missing.join("\n") + "\n" : "",
  );
  if (missing.length === 0) {
    console.log("No new capability IDs.");
    return;
  }

  const features = doc.get("features", true);
  if (!isMap(features)) {
    console.error("Compliance file has no `features` map to sync into.");
    process.exit(1);
  }

  const idIndex = new Map<string, number>();
  features.items.forEach((pair, index) => {
    if (isScalar(pair.key) && typeof pair.key.value === "string") {
      idIndex.set(pair.key.value, index);
    }
  });

  const byPrefix = new Map<string, string[]>();
  for (const id of missing) {
    const prefix = id.slice(0, id.lastIndexOf(".") + 1);
    const bucket = byPrefix.get(prefix);
    if (bucket) bucket.push(id);
    else byPrefix.set(prefix, [id]);
  }

  const insertions: { index: number; ids: string[] }[] = [];
  const orphans: string[] = [];
  for (const [prefix, ids] of byPrefix) {
    const siblingIndices = [...idIndex.entries()]
      .filter(([existingId]) => existingId.startsWith(prefix))
      .map(([, index]) => index);
    if (siblingIndices.length === 0) {
      orphans.push(...ids);
      continue;
    }
    // Insert right after the last existing sibling so the new IDs land in-group.
    insertions.push({ index: Math.max(...siblingIndices) + 1, ids });
  }

  // Splice back-to-front so earlier indices stay valid as items shift.
  for (const { index, ids } of insertions.sort((a, b) => b.index - a.index)) {
    const pairs = ids.map((id) => doc.createPair(id, "not_implemented"));
    features.items.splice(index, 0, ...pairs);
  }

  if (orphans.length > 0) {
    const pairs = orphans.map((id) => doc.createPair(id, "not_implemented"));
    (pairs[0].key as { commentBefore?: string }).commentBefore =
      " Newly synced from the canonical spec; no local group yet, place manually.";
    features.items.push(...pairs);
  }

  writeFileSync(resolve(compliancePath), doc.toString({ lineWidth: 0 }));
  console.log(
    `Added ${missing.length} new capability IDs (${orphans.length} without an existing group).`,
  );
}

main();
