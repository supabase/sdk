import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { checkNewSymbols, formatErrorMessage } from "./api-check.js";
import type { RawCompliance } from "./compliance.js";
import type { ParseResult } from "./ts-parser.js";

async function main(): Promise<void> {
  const [prFile, baseFile, compliancePath] = process.argv.slice(2);

  if (!prFile || !baseFile || !compliancePath) {
    console.error(
      "Usage: check-api-symbols <pr-symbols.json> <base-symbols.json> <sdk-compliance.yaml>",
    );
    process.exit(1);
  }

  let prResult: ParseResult;
  let baseResult: ParseResult;
  let compliance: RawCompliance;

  try {
    prResult = JSON.parse(readFileSync(resolve(prFile), "utf8")) as ParseResult;
  } catch (e) {
    console.error(`Failed to read PR symbols: ${(e as Error).message}`);
    process.exit(1);
  }

  try {
    baseResult = JSON.parse(
      readFileSync(resolve(baseFile), "utf8"),
    ) as ParseResult;
  } catch (e) {
    console.error(`Failed to read base symbols: ${(e as Error).message}`);
    process.exit(1);
  }

  try {
    compliance = parse(
      readFileSync(resolve(compliancePath), "utf8"),
    ) as RawCompliance;
  } catch (e) {
    console.error(`Failed to read compliance file: ${(e as Error).message}`);
    process.exit(1);
  }

  const { uncoveredSymbols } = checkNewSymbols(
    baseResult.symbols,
    prResult.symbols,
    compliance,
  );

  if (uncoveredSymbols.length === 0) {
    console.log("✅ All new public API symbols are covered in the capability matrix.");
    return;
  }

  console.error(formatErrorMessage(uncoveredSymbols, compliance.sdk));
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
