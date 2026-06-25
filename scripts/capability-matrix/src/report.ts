import { LANGUAGES } from "./types.js";
import type { ComplianceMap, Language, LoadedArea, ParityReport } from "./types.js";

export type { ParityReport };

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export function computeParity(
  loaded: LoadedArea[],
  compliance: Partial<Record<Language, ComplianceMap>>
): ParityReport {
  const featureParities: number[] = [];
  const perAreaParities: Record<string, number[]> = {};
  const perFeature: Record<string, number> = {};
  const langImplemented = Object.fromEntries(LANGUAGES.map((l) => [l, 0])) as Record<Language, number>;
  const langApplicable = Object.fromEntries(LANGUAGES.map((l) => [l, 0])) as Record<Language, number>;

  for (const { area } of loaded) {
    perAreaParities[area.area] ??= [];
    for (const feature of area.features ?? []) {
      let implemented = 0;
      let applicable = 0;
      for (const lang of LANGUAGES) {
        const status = compliance[lang]?.[feature.id]?.status ?? "not_implemented";
        if (status === "not_applicable") continue;
        applicable++;
        langApplicable[lang]++;
        if (status === "implemented" || status === "partially_implemented") {
          implemented++;
          langImplemented[lang]++;
        }
      }
      const parity = applicable === 0 ? 1 : implemented / applicable;
      featureParities.push(parity);
      perAreaParities[area.area].push(parity);
      perFeature[feature.id] = parity;
    }
  }

  const perArea: Record<string, number> = {};
  for (const [name, xs] of Object.entries(perAreaParities)) perArea[name] = mean(xs);

  const perLanguage = Object.fromEntries(
    LANGUAGES.map((l) => [l, langApplicable[l] === 0 ? 0 : langImplemented[l] / langApplicable[l]])
  ) as Record<Language, number>;

  return { overall: mean(featureParities), perArea, perLanguage, perFeature };
}
