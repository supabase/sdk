import { buildSymbolIndex } from "./compliance.js";
import type { RawCompliance } from "./compliance.js";
import type { ParsedSymbol } from "./ts-parser.js";

export interface CheckResult {
  newSymbols: string[];
  uncoveredSymbols: string[];
  removedRegisteredSymbols: Array<{ symbol: string; featureId: string }>;
}

export function checkNewSymbols(
  baseSymbols: ParsedSymbol[],
  prSymbols: ParsedSymbol[],
  compliance: RawCompliance,
): CheckResult {
  const baseNames = new Set(baseSymbols.map((s) => s.name));
  const prNames = new Set(prSymbols.map((s) => s.name));

  const newSymbols = prSymbols
    .filter((s) => !baseNames.has(s.name))
    .map((s) => s.name);

  const symbolIndex = buildSymbolIndex(compliance);
  const uncoveredSymbols = newSymbols.filter((sym) => !symbolIndex.has(sym));

  const removedRegisteredSymbols = baseSymbols
    .filter((s) => !prNames.has(s.name) && symbolIndex.has(s.name))
    .map((s) => ({ symbol: s.name, featureId: symbolIndex.get(s.name)! }));

  return { newSymbols, uncoveredSymbols, removedRegisteredSymbols };
}

export function formatErrorMessage(
  uncoveredSymbols: string[],
  sdkName: string,
): string {
  const lines: string[] = [
    "❌ Capability matrix check failed",
    "New public API detected that is not in the capability matrix:",
    ...uncoveredSymbols.map((s) => `  - ${s} (${sdkName})`),
    "",
    "Register each symbol in sdk-compliance.yaml under the appropriate feature:",
    "",
    "  auth.my_feature:",
    "    status: implemented",
    "    symbols:",
    `      - ${uncoveredSymbols[0] ?? "ClassName.methodName"}`,
    "",
    "If the feature does not exist in the matrix yet, add it there first:",
    "  https://github.com/supabase/sdk/blob/main/CONTRIBUTING.md",
  ];
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
