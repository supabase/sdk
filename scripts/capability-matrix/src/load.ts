import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { AreaFile, Finding, LoadedArea } from "./types";

export function loadAreas(dir: string): { areas: LoadedArea[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const areas: LoadedArea[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort();
  for (const name of files) {
    const file = join(dir, name);
    try {
      const doc = parse(readFileSync(file, "utf8")) as AreaFile;
      areas.push({ file, area: doc });
    } catch (e) {
      findings.push({ level: "error", file, message: `YAML parse error: ${(e as Error).message}` });
    }
  }
  return { areas, findings };
}
