import { LANGUAGES, STATUSES } from "./types.js";
import type { ComplianceEntry, ComplianceMap, Language, LoadedArea, Status } from "./types.js";

export interface ComplianceFinding {
  level: "error";
  message: string;
}

type RawValue = string | { status?: string; note?: string; symbols?: string[] };

export interface RawCompliance {
  sdk: string;
  features: Record<string, RawValue>;
}

export function validateCompliance(
  raw: RawCompliance,
  knownIds: Set<string>
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  if (!LANGUAGES.includes(raw.sdk as Language)) {
    findings.push({ level: "error", message: `unknown sdk "${raw.sdk}"` });
  }

  for (const [id, value] of Object.entries(raw.features ?? {})) {
    if (!knownIds.has(id)) {
      findings.push({ level: "error", message: `unknown feature id "${id}"` });
      continue;
    }

    let status: string;
    let note: string | undefined;

    if (typeof value === "string") {
      status = value;
    } else if (typeof value === "object" && value !== null) {
      status = value.status ?? "";
      note = value.note;
    } else {
      findings.push({
        level: "error",
        message: `"${id}": invalid entry — must be a status string or {status, note} object`,
      });
      continue;
    }

    if (!STATUSES.includes(status as Status)) {
      findings.push({ level: "error", message: `"${id}": unknown status "${status}"` });
    }

    if (status === "partially_implemented" && !note) {
      findings.push({ level: "error", message: `"${id}": partially_implemented requires a note` });
    }

    if (typeof value === "object" && value !== null && "symbols" in value && value.symbols !== undefined) {
      if (!Array.isArray(value.symbols)) {
        findings.push({ level: "error", message: `"${id}": symbols must be an array of strings` });
      } else if (value.symbols.some((s) => typeof s !== "string")) {
        findings.push({ level: "error", message: `"${id}": symbols must be an array of strings` });
      }
    }
  }

  return findings;
}

export function normalizeCompliance(raw: RawCompliance): ComplianceMap {
  const map: ComplianceMap = {};
  for (const [id, value] of Object.entries(raw.features ?? {})) {
    if (typeof value === "string") {
      map[id] = { status: value as Status };
    } else {
      map[id] = {
        status: (value.status ?? "not_implemented") as Status,
        ...(value.note !== undefined ? { note: value.note } : {}),
        ...(value.symbols !== undefined ? { symbols: value.symbols } : {}),
      };
    }
  }
  return map;
}

export function collectFeatureIds(areas: LoadedArea[]): Set<string> {
  const ids = new Set<string>();
  for (const { area } of areas) {
    for (const f of area.features ?? []) {
      if (f.id) ids.add(f.id);
    }
  }
  return ids;
}

// Returns a map from SDK symbol name → capability matrix feature ID.
// Built from the symbols arrays declared in sdk-compliance.yaml.
export function buildSymbolIndex(raw: RawCompliance): Map<string, string> {
  const index = new Map<string, string>();
  for (const [featureId, value] of Object.entries(raw.features ?? {})) {
    if (typeof value === "object" && value !== null && Array.isArray(value.symbols)) {
      for (const sym of value.symbols) {
        if (typeof sym === "string") index.set(sym, featureId);
      }
    }
  }
  return index;
}
