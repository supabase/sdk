import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadAreas } from "./load";
import { checkSchema } from "./schema";
import { checkStructural, checkSpecs } from "./structural";
import { loadCodegenConfig, checkCodegenConfig } from "./codegen";
import { checkBindings } from "./bindings";
import { checkConformance } from "./conformance";
import { computeParity, type ParityReport } from "./report";
import type { Finding } from "./types";

export interface RunOptions {
  mode: "validate" | "report";
  capabilitiesDir: string;
  schema: object;
  specsDir?: string;
  changedFiles?: string[];
  codegenConfigPath?: string;
  codegenSchema?: object;
  conformanceDir?: string;
  conformanceSchema?: object;
}

export interface RunResult {
  findings: Finding[];
  errorCount: number;
  report?: ParityReport;
}

export async function run(opts: RunOptions): Promise<RunResult> {
  const { areas, findings: loadFindings } = loadAreas(opts.capabilitiesDir);

  if (opts.mode === "report") {
    return { findings: loadFindings, errorCount: loadFindings.filter((f) => f.level === "error").length, report: computeParity(areas, {}) };
  }

  const findings: Finding[] = [...loadFindings];
  findings.push(...checkSchema(areas, opts.schema));
  findings.push(...checkStructural(areas));

  const knownIds = new Set(areas.flatMap((a) => a.area.features.map((f) => f.id)));

  if (opts.specsDir) {
    findings.push(...checkSpecs(opts.specsDir, knownIds));
  }

  if (opts.codegenConfigPath && opts.codegenSchema && existsSync(opts.codegenConfigPath)) {
    const { config, findings: loadFindings2 } = loadCodegenConfig(opts.codegenConfigPath);
    findings.push(...loadFindings2);
    if (config) {
      findings.push(...checkCodegenConfig(config, opts.codegenSchema, opts.codegenConfigPath));
      findings.push(...checkBindings(areas, config));
    }
  }

  if (opts.conformanceDir && opts.conformanceSchema) {
    findings.push(...checkConformance(opts.conformanceDir, knownIds, opts.conformanceSchema));
  }

  const errorCount = findings.filter((f) => f.level === "error").length;
  return { findings, errorCount };
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

async function main(): Promise<void> {
  const root = repoRoot();
  const argv = process.argv.slice(2);
  const mode = (argv[0] === "report" ? "report" : "validate") as "validate" | "report";
  const positionals = argv.slice(1).filter((a) => !a.startsWith("--"));

  const schema = JSON.parse(readFileSync(join(root, "schema", "capability-matrix.schema.json"), "utf8"));
  const codegenSchema = JSON.parse(readFileSync(join(root, "schema", "codegen.schema.json"), "utf8"));
  const conformanceSchema = JSON.parse(readFileSync(join(root, "schema", "conformance.schema.json"), "utf8"));
  const result = await run({
    mode,
    capabilitiesDir: join(root, "capabilities"),
    specsDir: join(root, "specs"),
    schema,
    codegenConfigPath: join(root, "codegen.yaml"),
    codegenSchema,
    conformanceDir: join(root, "conformance"),
    conformanceSchema,
    changedFiles: positionals.length > 0 ? positionals : undefined,
  });

  if (result.report) {
    console.log(JSON.stringify(result.report, null, 2));
    if (result.findings.length > 0) {
      for (const f of result.findings) {
        const tag = f.level === "error" ? "ERROR" : "WARN ";
        process.stderr.write(`${tag} ${f.file}: ${f.message}\n`);
      }
    }
    return;
  }

  for (const f of result.findings) {
    const tag = f.level === "error" ? "ERROR" : "WARN ";
    console.log(`${tag} ${f.file}: ${f.message}`);
  }
  if (result.errorCount > 0) {
    console.error(`\n${result.errorCount} error(s) found.`);
    process.exit(1);
  }
  console.log("\nOK — capability matrix is valid.");
}

// Run main only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
