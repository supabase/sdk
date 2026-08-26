import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { Finding, LoadedArea } from "./types.js";

export function checkStructural(loaded: LoadedArea[]): Finding[] {
  const findings: Finding[] = [];
  const seenIds = new Map<string, string>();

  for (const { file, area } of loaded) {
    const fileArea = basename(file, ".yaml");
    if (area?.area !== fileArea) {
      findings.push({
        level: "error",
        file,
        message: `area "${area?.area}" does not match filename "${fileArea}"`,
      });
    }

    for (const feature of area?.features ?? []) {
      const prefix = `${area.area}.`;
      if (!feature.id?.startsWith(prefix)) {
        findings.push({
          level: "error",
          file,
          message: `feature id "${feature.id}" must start with "${prefix}"`,
        });
      }

      if (feature.id) {
        const prev = seenIds.get(feature.id);
        if (prev !== undefined) {
          findings.push({
            level: "error",
            file,
            message: `duplicate feature id "${feature.id}" (also defined in ${prev})`,
          });
        } else {
          seenIds.set(feature.id, file);
        }
      }
    }
  }
  return findings;
}

export function checkSpecs(specsDir: string, knownIds: Set<string>): Finding[] {
  const findings: Finding[] = [];
  try {
    // Expected layout: specs/<area>/<namespace>/<method>.md → id area.namespace.method
    for (const areaEntry of readdirSync(specsDir, { withFileTypes: true })) {
      if (!areaEntry.isDirectory()) continue;
      const areaDir = join(specsDir, areaEntry.name);
      for (const nsEntry of readdirSync(areaDir, { withFileTypes: true })) {
        if (!nsEntry.isDirectory()) continue;
        const nsDir = join(areaDir, nsEntry.name);
        for (const file of readdirSync(nsDir)) {
          if (!file.endsWith(".md")) continue;
          const id = `${areaEntry.name}.${nsEntry.name}.${file.slice(0, -3)}`;
          if (!knownIds.has(id)) {
            findings.push({
              level: "error",
              file: join(nsDir, file),
              message: `spec has no matching feature id "${id}" in any capabilities YAML`,
            });
          }
        }
      }
    }
  } catch { /* specs dir absent */ }
  return findings;
}
