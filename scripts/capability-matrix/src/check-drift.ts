import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { checkDrift, formatDriftSummary } from "./drift-check.js";
import { buildSourceMap } from "./compliance-source-map.js";
import type { RawCompliance } from "./compliance.js";
import type { ParseResult } from "./normalize-typedoc.js";

async function main(): Promise<void> {
  const [compliancePath, prFile, annotationPath] = process.argv.slice(2);

  if (!compliancePath || !prFile) {
    console.error("Usage: check-drift <sdk-compliance.yaml> <pr-symbols.json> [annotation-file-path]");
    return;
  }

  let complianceText: string;
  let compliance: RawCompliance;

  try {
    complianceText = readFileSync(resolve(compliancePath), "utf8");
    compliance = parse(complianceText) as RawCompliance;
  } catch (e) {
    console.error(`Failed to read compliance file: ${(e as Error).message}`);
    return;
  }

  let prResult: ParseResult;
  try {
    prResult = JSON.parse(readFileSync(resolve(prFile), "utf8")) as ParseResult;
  } catch (e) {
    console.error(`Failed to read PR symbols: ${(e as Error).message}`);
    return;
  }

  const findings = checkDrift(prResult.symbols, compliance);

  if (findings.length === 0) {
    console.log("✅ No capability matrix drift detected.");
    return;
  }

  const sourceMap = buildSourceMap(complianceText);
  const annotationFile = annotationPath ?? compliancePath;

  for (const finding of findings) {
    const line = finding.symbol
      ? sourceMap.symbolLines.get(finding.symbol)
      : sourceMap.featureLines.get(finding.featureId);
    const message = finding.symbol
      ? `${finding.featureId}: expected symbol ${finding.symbol} not found in ${compliance.sdk}`
      : `${finding.featureId}: marked implemented but has no registered symbols to verify`;
    console.log(
      line !== undefined
        ? `::warning file=${annotationFile},line=${line}::${message}`
        : `::warning::${message}`,
    );
  }

  const summary = formatDriftSummary(findings, compliance.sdk);
  writeFileSync(resolve("drift-summary.md"), summary, "utf8");
  console.error(summary);
}

main().catch((e) => { console.error(e); });
