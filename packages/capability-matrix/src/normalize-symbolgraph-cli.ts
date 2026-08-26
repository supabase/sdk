import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeSymbolGraph, type SymbolGraphSymbol } from "./normalize-symbolgraph.js";

async function main(): Promise<void> {
  const [,, rawPath, sdkRootArg] = process.argv;
  if (!rawPath) {
    console.error("Usage: normalize-symbolgraph <merged-symbols.json> [sdk-root]");
    process.exit(1);
  }

  const sdkRoot = sdkRootArg ? resolve(sdkRootArg) : "";
  const symbols = JSON.parse(readFileSync(rawPath, "utf8")) as SymbolGraphSymbol[];
  const result = normalizeSymbolGraph(symbols, sdkRoot);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
