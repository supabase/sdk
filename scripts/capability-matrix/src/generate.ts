import { spawnSync } from "node:child_process";
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
  ];
  if (lang.templates) {
    args.push("--template-dir", lang.templates);
  }

  const extra = lang.generatorProperties;
  if (extra && Object.keys(extra).length > 0) {
    const pairs = Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(",");
    args.push(`--additional-properties=${pairs}`);
  }

  return args;
}

export interface RunGenerateOptions {
  cwd: string;
  bin?: string;
  stdio?: "inherit" | "pipe";
}

/** Spawns openapi-generator with the args from buildGenerateArgs. Throws on non-zero exit. */
export function runGenerate(config: CodegenConfig, target: GenerateTarget, opts: RunGenerateOptions): void {
  const args = buildGenerateArgs(config, target);
  const bin = opts.bin ?? "openapi-generator";
  const res = spawnSync(bin, args, { cwd: opts.cwd, stdio: opts.stdio ?? "inherit" });
  if (res.error) throw new Error(`failed to spawn ${bin}: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`${bin} ${args.join(" ")} exited with status ${res.status}`);
}
