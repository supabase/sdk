import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadAreas } from "./load";
import { checkSchema } from "./schema";
import { checkStructural, checkSpecs } from "./structural";
import { checkReferences, type RepoClient } from "./references";
import { githubClient } from "./github";
import { computeParity, type ParityReport } from "./report";
import type { Finding } from "./types";

export interface RunOptions {
  mode: "validate" | "report";
  capabilitiesDir: string;
  schema: object;
  online: boolean;
  specsDir?: string;
  changedFiles?: string[];
  token?: string;
  repoClient?: RepoClient;
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

  if (opts.specsDir) {
    const knownIds = new Set(areas.flatMap((a) => a.area.features.map((f) => f.id)));
    findings.push(...checkSpecs(opts.specsDir, knownIds));
  }

  if (opts.online) {
    let target = areas;
    if (opts.changedFiles && opts.changedFiles.length > 0) {
      const set = new Set(opts.changedFiles.map((f) => resolve(f)));
      target = areas.filter((a) => set.has(resolve(a.file)));
    }
    findings.push(...(await checkReferences(target, opts.repoClient ?? githubClient(opts.token))));
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
  const flags = argv.filter((a) => a.startsWith("--"));
  const positionals = argv.slice(1).filter((a) => !a.startsWith("--"));
  const online = flags.includes("--online") || process.env.CHECK_REFERENCES === "1";

  const schema = JSON.parse(readFileSync(join(root, "schema", "capability-matrix.schema.json"), "utf8"));
  const result = await run({
    mode,
    capabilitiesDir: join(root, "capabilities"),
    specsDir: join(root, "specs"),
    schema,
    online,
    changedFiles: positionals.length > 0 ? positionals : undefined,
    token: process.env.GITHUB_TOKEN,
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
