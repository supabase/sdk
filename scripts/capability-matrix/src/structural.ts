import { basename } from "node:path";
import { LANGUAGES } from "./types";
import type { Finding, LoadedArea } from "./types";

const SEMVER = /^\d+\.\d+\.\d+(?:[-+].+)?$/;

export function checkStructural(loaded: LoadedArea[]): Finding[] {
  const findings: Finding[] = [];
  const seenIds = new Map<string, string>();

  for (const { file, area } of loaded) {
    const fileArea = basename(file, ".yaml");
    if (area?.area !== fileArea) {
      findings.push({ level: "error", file, message: `area "${area?.area}" does not match filename "${fileArea}"` });
    }

    for (const feature of area?.features ?? []) {
      const prefix = `${area.area}.`;
      if (!feature.id?.startsWith(prefix)) {
        findings.push({ level: "error", file, message: `feature id "${feature.id}" must start with "${prefix}"` });
      }

      const prev = seenIds.get(feature.id);
      if (prev !== undefined) {
        findings.push({ level: "error", file, message: `duplicate feature id "${feature.id}" (also defined in ${prev})` });
      } else {
        seenIds.set(feature.id, file);
      }

      for (const lang of LANGUAGES) {
        const entry = feature.sdks?.[lang];
        if (!entry) continue;
        if (entry.since !== undefined && !SEMVER.test(entry.since)) {
          findings.push({ level: "error", file, message: `${feature.id}.${lang}.since "${entry.since}" is not valid semver` });
        }
        if (entry.status === "not_applicable" && !entry.notes) {
          findings.push({ level: "warning", file, message: `${feature.id}.${lang} is not_applicable without notes` });
        }
      }
    }
  }
  return findings;
}
