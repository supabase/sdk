export const LANGUAGES = [
  "javascript",
  "flutter",
  "python",
  "swift",
  "csharp",
  "go",
  "kotlin",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const CORE_LANGUAGES = [
  "javascript",
  "flutter",
  "python",
  "swift",
] as const satisfies readonly Language[];

export const STATUSES = [
  "implemented",
  "partially_implemented",
  "not_implemented",
  "not_applicable",
] as const;
export type Status = (typeof STATUSES)[number];

export interface Group {
  id: string;
  title: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  group?: string;
}

export interface AreaFile {
  area: string;
  title: string;
  description: string;
  groups?: Group[];
  features: Feature[];
}

export interface LoadedArea {
  file: string;
  area: AreaFile;
}

export interface Finding {
  level: "error" | "warning";
  file: string;
  message: string;
}

export interface ComplianceEntry {
  status: Status;
  note?: string;
  symbols?: string[];
}

// Feature ID → ComplianceEntry (sparse; unlisted features default to not_implemented)
export type ComplianceMap = Record<string, ComplianceEntry>;

export interface ParityReport {
  overall: number;
  perArea: Record<string, number>;
  perLanguage: Record<Language, number>;
  coverageScope: number;
}

/** Shape of site/compliance.json — raw compliance data plus precomputed parity. */
export interface ComplianceFile {
  compliance: Partial<Record<Language, ComplianceMap>>;
  parity: ParityReport;
}
