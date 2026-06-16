import type { CodegenConfig } from "./codegen";

export interface GenerateTarget {
  spec: string;
  language: string;
  outDir: string;
}

/**
 * Builds the argv for `openapi-generator-cli generate` from the codegen config
 * and a target. Pure function — the engine version pin is applied by the
 * openapi-generator-cli toolchain (openapitools.json), not here.
 */
export function buildGenerateArgs(config: CodegenConfig, target: GenerateTarget): string[] {
  const spec = config.specs[target.spec];
  if (!spec) throw new Error(`unknown spec "${target.spec}" (not declared in codegen config)`);
  const lang = config.languages[target.language];
  if (!lang) throw new Error(`unknown language "${target.language}" (not declared in codegen config)`);

  const args = [
    "generate",
    "--input-spec", spec.source,
    "--generator-name", lang.generator,
    "--output", target.outDir,
    "--template-dir", lang.templates,
  ];

  const extra = lang.generatorProperties;
  if (extra && Object.keys(extra).length > 0) {
    const pairs = Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(",");
    args.push(`--additional-properties=${pairs}`);
  }

  return args;
}
