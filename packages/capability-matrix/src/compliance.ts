import { LANGUAGES, STATUSES } from "./types.js";
import type { ComplianceEntry, ComplianceMap, Language, LoadedArea, Status } from "./types.js";

export interface ComplianceFinding {
  level: "error";
  message: string;
}

type RawValue =
  | string
  | { status?: string; note?: string; symbols?: string[]; supporting_symbols?: string[] };

export interface RawCompliance {
  sdk: string;
  features: Record<string, RawValue>;
  supporting_symbols?: string[];
}

// Pseudo feature ID reported for symbols registered in the top-level
// supporting_symbols list, which belong to no single capability.
export const TOP_LEVEL_SUPPORTING = "supporting_symbols";

function checkSymbolList(
  value: unknown,
  label: string,
  context: string,
  findings: ComplianceFinding[]
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((s) => typeof s !== "string")) {
    findings.push({
      level: "error",
      message: `${context}: ${label} must be an array of strings`,
    });
  }
}

export function validateCompliance(
  raw: RawCompliance,
  knownIds: Set<string>
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  if (!LANGUAGES.includes(raw.sdk as Language)) {
    findings.push({ level: "error", message: `unknown sdk "${raw.sdk}"` });
  }

  checkSymbolList(raw.supporting_symbols, "supporting_symbols", "top level", findings);

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

    if (typeof value === "object" && value !== null) {
      checkSymbolList(value.symbols, "symbols", `"${id}"`, findings);
      checkSymbolList(value.supporting_symbols, "supporting_symbols", `"${id}"`, findings);
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
        ...(value.supporting_symbols !== undefined
          ? { supporting_symbols: value.supporting_symbols }
          : {}),
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

export function findMissingFeatureIds(raw: RawCompliance, knownIds: Set<string>): string[] {
  const declared = new Set(Object.keys(raw.features ?? {}));
  return [...knownIds].filter((id) => !declared.has(id)).sort();
}

// Returns a map from SDK symbol name → capability matrix feature ID, covering
// every symbol the compliance file accounts for: entry points (`symbols`) and
// the supporting public API around them (`supporting_symbols`, per feature or
// top level). Used by the new-symbol check, which only asks whether a symbol is
// accounted for at all. Entry points are indexed last so that a symbol listed
// both ways is attributed to the capability it implements rather than to the
// supporting bucket.
export function buildSymbolIndex(raw: RawCompliance): Map<string, string> {
  const index = new Map<string, string>();

  for (const sym of raw.supporting_symbols ?? []) {
    if (typeof sym === "string") index.set(sym, TOP_LEVEL_SUPPORTING);
  }

  const entries = Object.entries(raw.features ?? {}).filter(
    (entry): entry is [string, Exclude<RawValue, string>] =>
      typeof entry[1] === "object" && entry[1] !== null
  );

  for (const [featureId, value] of entries) {
    if (!Array.isArray(value.supporting_symbols)) continue;
    for (const sym of value.supporting_symbols) {
      if (typeof sym === "string") index.set(sym, featureId);
    }
  }

  for (const [featureId, value] of entries) {
    if (!Array.isArray(value.symbols)) continue;
    for (const sym of value.symbols) {
      if (typeof sym === "string") index.set(sym, featureId);
    }
  }

  return index;
}
