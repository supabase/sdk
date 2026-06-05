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

export const STATUSES = ["implemented", "not_implemented", "not_applicable"] as const;
export type Status = (typeof STATUSES)[number];

export interface Reference {
  repo: string;
  path: string;
  symbols?: string[];
  ref?: string;
}

export interface SdkEntry {
  status: Status;
  since?: string;
  notes?: string;
  references?: Reference[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  group?: string;
  sdks: Record<Language, SdkEntry>;
}

export interface AreaFile {
  area: string;
  title: string;
  description: string;
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
