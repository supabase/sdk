import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { compileSchema } from "./schema";
import type { Finding } from "./types";

export interface SpecSource {
  source: string;
  version: string;
}

export interface LanguageConfig {
  generator: string;
  templates: string;
  generatorProperties?: Record<string, string>;
}

export interface CodegenConfig {
  engine: { tool: string; version: string };
  specs: Record<string, SpecSource>;
  languages: Record<string, LanguageConfig>;
}

export function loadCodegenConfig(file: string): { config?: CodegenConfig; findings: Finding[] } {
  try {
    const config = parse(readFileSync(file, "utf8")) as CodegenConfig;
    return { config, findings: [] };
  } catch (e) {
    return { findings: [{ level: "error", file, message: `codegen config parse error: ${(e as Error).message}` }] };
  }
}

export function checkCodegenConfig(config: unknown, schema: object, file = "codegen.yaml"): Finding[] {
  const validate = compileSchema(schema);
  if (validate(config)) return [];
  return (validate.errors ?? []).map((err) => ({
    level: "error" as const,
    file,
    message: `codegen schema: ${err.instancePath || "/"} ${err.message ?? "invalid"}`,
  }));
}
