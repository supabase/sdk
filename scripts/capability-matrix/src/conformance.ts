import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { compileSchema } from "./schema";
import type { Finding } from "./types";

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(p));
    else if (entry.name.endsWith(".yaml")) out.push(p);
  }
  return out;
}

export function checkConformance(dir: string, knownIds: Set<string>, schema: object): Finding[] {
  const findings: Finding[] = [];
  const validate = compileSchema(schema);

  let files: string[];
  try {
    files = collectFiles(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return findings; // conformance dir absent
    throw e;
  }

  for (const file of files) {
    let doc: unknown;
    try {
      doc = parse(readFileSync(file, "utf8"));
    } catch (e) {
      findings.push({ level: "error", file, message: `YAML parse error: ${(e as Error).message}` });
      continue;
    }
    if (!validate(doc)) {
      for (const err of validate.errors ?? []) {
        findings.push({ level: "error", file, message: `conformance: ${err.instancePath || "/"} ${err.message ?? "invalid"}` });
      }
      continue;
    }
    const feature = (doc as { feature: string }).feature;
    if (!knownIds.has(feature)) {
      findings.push({ level: "error", file, message: `conformance vector references unknown feature id "${feature}"` });
    }
  }
  return findings;
}
