import { basename } from "node:path";
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
