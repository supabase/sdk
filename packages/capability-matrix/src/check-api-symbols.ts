import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import {
  checkFullCoverage,
  checkNewSymbols,
  formatErrorMessage,
  formatRemovedMessage,
} from "./api-check.js";
import { getApiCoverageMode, type RawCompliance } from "./compliance.js";
import type { ParseResult } from "./normalize-typedoc.js";

async function main(): Promise<void> {
  const [prFile, baseFile, compliancePath] = process.argv.slice(2);

  if (!prFile || !baseFile || !compliancePath) {
    console.error(
      "Usage: check-api-symbols <pr-symbols.json> <base-symbols.json> <sdk-compliance.yaml>",
    );
    process.exit(1);
  }

  let prResult: ParseResult;
  let baseResult: ParseResult | undefined;
  let compliance: RawCompliance;

  try {
    prResult = JSON.parse(readFileSync(resolve(prFile), "utf8")) as ParseResult;
  } catch (e) {
    console.error(`Failed to read PR symbols: ${(e as Error).message}`);
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

  const coverageMode = getApiCoverageMode(compliance);

  if (coverageMode === "additions") {
    if (baseFile === "-") {
      console.error("Additions coverage requires a base symbol file and a pull request event.");
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
  }

  const result =
    coverageMode === "full"
      ? checkFullCoverage(prResult.symbols, compliance)
      : checkNewSymbols(baseResult?.symbols ?? [], prResult.symbols, compliance);
  const { uncoveredSymbols, removedRegisteredSymbols } = result;

  if (uncoveredSymbols.length === 0 && removedRegisteredSymbols.length === 0) {
    console.log(
      coverageMode === "full"
        ? "✅ The complete public API is covered in the capability matrix."
        : "✅ All new public API symbols are covered in the capability matrix.",
    );
    return;
  }

  if (uncoveredSymbols.length > 0) {
    console.error(
      formatErrorMessage(
        uncoveredSymbols,
        compliance.sdk,
        coverageMode,
        process.env.GITHUB_BASE_REF,
      ),
    );
  }
  if (removedRegisteredSymbols.length > 0) {
    if (uncoveredSymbols.length > 0) console.error("");
    console.error(formatRemovedMessage(removedRegisteredSymbols, compliance.sdk));
  }
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
