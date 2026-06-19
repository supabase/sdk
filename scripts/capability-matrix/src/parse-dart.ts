import { parseDartProject } from "./dart-parser.js";

async function main(): Promise<void> {
  const projectPath = process.argv[2];
  if (!projectPath) {
    console.error("Usage: parse-dart <path-to-sdk-root>");
    process.exit(1);
  }

  try {
    const result = parseDartProject(projectPath);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
