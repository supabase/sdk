import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { extractSymbolGraphs } from "./extract.js";
import { transformSymbolGraph } from "./transform.js";

const sdkRoot = process.argv[2];
const outputPath = process.argv[3] ?? "typedoc.json";

if (!sdkRoot) {
  console.error("Usage: tsx src/index.ts <sdk-root> [output.json]");
  process.exit(1);
}

const root = resolve(sdkRoot);
const out = resolve(outputPath);

console.error(`Extracting symbol graphs from ${root}...`);
const graphs = extractSymbolGraphs(root);
console.error(`Found ${graphs.length} symbol graph(s).`);

const moduleName = graphs[0]?.module.name ?? "Module";
const project = transformSymbolGraph(graphs, moduleName);

writeFileSync(out, JSON.stringify(project, null, 2), "utf8");
console.error(`Written to ${out}`);
