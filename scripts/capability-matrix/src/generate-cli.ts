import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadCodegenConfig } from "./codegen";
import { runGenerate } from "./generate";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function main(): void {
  const root = repoRoot();
  const { config, findings } = loadCodegenConfig(join(root, "codegen.yaml"));
  if (!config) {
    for (const f of findings) console.error(`ERROR ${f.file}: ${f.message}`);
    process.exit(1);
  }
  const targets = config.targets ?? [];
  if (targets.length === 0) {
    console.log("no targets declared in codegen.yaml");
    return;
  }
  for (const t of targets) {
    console.log(`generating ${t.spec} -> ${t.language} into ${t.output}`);
    // codegen.yaml paths are repo-root relative; run with cwd=root so they resolve.
    runGenerate(config, { spec: t.spec, language: t.language, outDir: t.output }, { cwd: root });
  }
}

main();
