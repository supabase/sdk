import { CORE_LANGUAGES, LANGUAGES } from "./types.js";
import type { ComplianceMap, Language, LoadedArea, ParityReport } from "./types.js";

export type { ParityReport };

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const isDone = (status: string): boolean =>
  status === "implemented" || status === "partially_implemented";

export function computeParity(
  loaded: LoadedArea[],
  compliance: Partial<Record<Language, ComplianceMap>>
): ParityReport {
  const featurePasses: number[] = [];
  const perAreaPasses: Record<string, number[]> = {};
  const langImplemented = Object.fromEntries(LANGUAGES.map((l) => [l, 0])) as Record<Language, number>;
  const langApplicable = Object.fromEntries(LANGUAGES.map((l) => [l, 0])) as Record<Language, number>;
  let doneCells = 0;
  let doneCellsWithSymbols = 0;

  for (const { area } of loaded) {
    perAreaPasses[area.area] ??= [];
    for (const feature of area.features ?? []) {
      // Strict cross-SDK pass check (core languages only)
      const applicableCore = CORE_LANGUAGES.filter(
        (lang) => (compliance[lang]?.[feature.id]?.status ?? "not_implemented") !== "not_applicable"
      );
      const passes =
        applicableCore.length > 0 &&
        applicableCore.every((lang) => compliance[lang]?.[feature.id]?.status === "implemented");
      const passValue = passes ? 1 : 0;
      featurePasses.push(passValue);
      perAreaPasses[area.area].push(passValue);

      // Per-language completion score (all 7 langs, unchanged semantics)
      for (const lang of LANGUAGES) {
        const status = compliance[lang]?.[feature.id]?.status ?? "not_implemented";
        if (status === "not_applicable") continue;
        langApplicable[lang]++;
        if (isDone(status)) langImplemented[lang]++;
      }

      // Coverage scope (core languages only)
      for (const lang of CORE_LANGUAGES) {
        const entry = compliance[lang]?.[feature.id];
        const status = entry?.status ?? "not_implemented";
        if (!isDone(status)) continue;
        doneCells++;
        if (entry?.symbols && entry.symbols.length > 0) doneCellsWithSymbols++;
      }
    }
  }

  const perArea: Record<string, number> = {};
  for (const [name, xs] of Object.entries(perAreaPasses)) perArea[name] = mean(xs);

  const perLanguage = Object.fromEntries(
    LANGUAGES.map((l) => [l, langApplicable[l] === 0 ? 0 : langImplemented[l] / langApplicable[l]])
  ) as Record<Language, number>;

  return {
    overall: mean(featurePasses),
    perArea,
    perLanguage,
    coverageScope: doneCells === 0 ? 0 : doneCellsWithSymbols / doneCells,
  };
}
