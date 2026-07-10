import type { RawCompliance } from "./compliance.js";
import type { ParsedSymbol } from "./normalize-typedoc.js";

export interface DriftFinding {
  featureId: string;
  symbol?: string;
}

export function checkDrift(
  prSymbols: ParsedSymbol[],
  compliance: RawCompliance,
): DriftFinding[] {
  const prNames = new Set(prSymbols.map((s) => s.name));
  const findings: DriftFinding[] = [];

  for (const [featureId, value] of Object.entries(compliance.features ?? {})) {
    let status: string | undefined;
    let symbols: string[] | undefined;

    if (typeof value === "string") {
      status = value;
    } else if (typeof value === "object" && value !== null) {
      status = value.status;
      symbols = value.symbols;
    }

    if (status !== "implemented") continue;

    if (!symbols || symbols.length === 0) {
      findings.push({ featureId });
      continue;
    }

    for (const symbol of symbols) {
      if (!prNames.has(symbol)) {
        findings.push({ featureId, symbol });
      }
    }
  }

  return findings;
}

export function formatDriftSummary(findings: DriftFinding[], sdkName: string): string {
  const missingSymbol = findings.filter((f) => f.symbol !== undefined);
  const unverifiable = findings.filter((f) => f.symbol === undefined);

  const lines: string[] = [
    "<!-- capability-matrix-drift -->",
    "⚠️ Capability matrix drift detected",
  ];

  if (missingSymbol.length > 0) {
    lines.push(
      "",
      `The following capabilities are marked \`implemented\` in the matrix but could not be found in ${sdkName}:`,
      ...missingSymbol.map((f) => `  - ${f.featureId} → expected symbol: ${f.symbol}`),
    );
  }

  if (unverifiable.length > 0) {
    lines.push(
      "",
      `The following capabilities are marked \`implemented\` in ${sdkName} but have no registered symbols to verify:`,
      ...unverifiable.map(
        (f) => `  - ${f.featureId} (no \`symbols\` list — cannot confirm implementation exists)`,
      ),
    );
  }

  lines.push(
    "",
    "These may have been renamed, removed, or never registered. Please update the capability matrix.",
    "See: https://github.com/supabase/sdk/blob/main/docs/capability-matrix.md",
  );

  return lines.join("\n");
}
