import { parseTypeScriptProject } from "./ts-parser.js";

async function main(): Promise<void> {
  const projectPath = process.argv[2];
  if (!projectPath) {
    console.error("Usage: parse-ts <path-to-sdk-root>");
    process.exit(1);
  }

  try {
    const result = parseTypeScriptProject(projectPath);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
