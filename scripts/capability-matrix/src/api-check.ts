import { buildSymbolIndex } from "./compliance.js";
import type { RawCompliance } from "./compliance.js";
import type { ParsedSymbol } from "./normalize-typedoc.js";

export interface CheckResult {
  newSymbols: string[];
  uncoveredSymbols: ParsedSymbol[];
  removedRegisteredSymbols: Array<{ symbol: string; featureId: string }>;
}

export function checkNewSymbols(
  baseSymbols: ParsedSymbol[],
  prSymbols: ParsedSymbol[],
  compliance: RawCompliance,
): CheckResult {
  const baseNames = new Set(baseSymbols.map((s) => s.name));
  const prNames = new Set(prSymbols.map((s) => s.name));

  const newSymbolObjs = prSymbols.filter((s) => !baseNames.has(s.name));
  const newSymbols = newSymbolObjs.map((s) => s.name);

  const symbolIndex = buildSymbolIndex(compliance);
  const uncoveredSymbols = newSymbolObjs.filter((s) => !symbolIndex.has(s.name));

  const removedRegisteredSymbols = baseSymbols
    .filter((s) => !prNames.has(s.name) && symbolIndex.has(s.name))
    .map((s) => ({ symbol: s.name, featureId: symbolIndex.get(s.name)! }));

  return { newSymbols, uncoveredSymbols, removedRegisteredSymbols };
}

export function formatErrorMessage(
  uncoveredSymbols: ParsedSymbol[],
  sdkName: string,
): string {
  const lines: string[] = [
    "❌ Capability matrix check failed",
    "New public API detected that is not in the capability matrix:",
  ];
  for (const s of uncoveredSymbols) {
    lines.push(`  - ${s.name} (${sdkName})`);
    if (s.file) {
      const location = s.line !== undefined ? `${s.file}:${s.line}` : s.file;
      lines.push(`    defined at: ${location}`);
    }
  }
  lines.push(
    "",
    "Register each symbol in sdk-compliance.yaml under the appropriate feature:",
    "",
    "  auth.my_feature:",
    "    status: implemented",
    "    symbols:",
    `      - ${uncoveredSymbols[0]?.name ?? "ClassName.methodName"}`,
    "",
    "If the feature does not exist in the matrix yet, add it there first:",
    "  https://github.com/supabase/sdk/blob/main/CONTRIBUTING.md",
  );
  return lines.join("\n");
}

export function formatRemovedMessage(
  removedRegisteredSymbols: Array<{ symbol: string; featureId: string }>,
  sdkName: string,
): string {
  const lines: string[] = [
    "❌ Capability matrix check failed",
    "Registered public API was removed — sdk-compliance.yaml is now stale:",
    ...removedRegisteredSymbols.map((r) => `  - ${r.symbol} (${sdkName}) → ${r.featureId}`),
    "",
    "Update the affected feature entries in sdk-compliance.yaml:",
    "  - Remove the symbol from the symbols list",
    "  - Update the status if the feature is no longer implemented",
  ];
  return lines.join("\n");
}
