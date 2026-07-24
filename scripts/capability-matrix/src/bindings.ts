import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CodegenConfig } from "./codegen";
import type { Finding, LoadedArea } from "./types";

export function checkBindings(loaded: LoadedArea[], config: CodegenConfig): Finding[] {
  const findings: Finding[] = [];
  for (const { file, area } of loaded) {
    for (const feature of area?.features ?? []) {
      const binding = feature.binding;
      if (!binding) continue;
      if (!config.specs[binding.spec]) {
        findings.push({
          level: "error",
          file,
          message: `feature "${feature.id}" binds to unknown spec "${binding.spec}" (not declared in codegen config)`,
        });
      }
    }
  }
  return findings;
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"];

function specOperationIds(file: string): Set<string> {
  const doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;
  const ids = new Set<string>();
  for (const item of Object.values(doc.paths ?? {})) {
    for (const m of HTTP_METHODS) {
      const op = (item as any)?.[m];
      if (op?.operationId) ids.add(op.operationId);
    }
  }
  return ids;
}

/**
 * Verifies each feature binding's operationId exists in its referenced spec.
 * `baseDir` is the directory codegen.yaml lives in (spec.source is relative to it).
 */
export function checkBindingOperations(loaded: LoadedArea[], config: CodegenConfig, baseDir: string): Finding[] {
  const findings: Finding[] = [];
  const cache = new Map<string, Set<string> | null>();
  for (const { file, area } of loaded) {
    for (const feature of area?.features ?? []) {
      const binding = feature.binding;
      if (!binding) continue;
      const spec = config.specs[binding.spec];
      if (!spec) continue; // unknown spec already reported by checkBindings
      const specFile = resolve(baseDir, spec.source);
      if (!cache.has(specFile)) {
        try {
          cache.set(specFile, specOperationIds(specFile));
        } catch (e) {
          findings.push({ level: "error", file, message: `cannot read spec "${spec.source}" for operationId check: ${(e as Error).message}` });
          cache.set(specFile, null);
        }
      }
      const ids = cache.get(specFile);
      if (!ids) continue; // null = spec unreadable (already reported once); empty Set is truthy and still checked
      if (!ids.has(binding.operationId)) {
        findings.push({ level: "error", file, message: `feature "${feature.id}" binds to operationId "${binding.operationId}" not present in spec "${binding.spec}"` });
      }
    }
  }
  return findings;
}
