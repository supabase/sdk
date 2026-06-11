import { describe, it, expect } from "vitest";
import { computeParity } from "../src/report";
import type { ComplianceMap, Language, LoadedArea } from "../src/types";

function feature(id: string) {
  return { id, name: id, description: "d" };
}

function area(id: string, features: ReturnType<typeof feature>[]): LoadedArea {
  return { file: "auth.yaml", area: { area: id, title: "T", description: "d", features } };
}

function compliance(lang: Language, statuses: Record<string, string>): Partial<Record<Language, ComplianceMap>> {
  const map: ComplianceMap = {};
  for (const [id, status] of Object.entries(statuses)) {
    map[id] = { status: status as never };
  }
  return { [lang]: map };
}

describe("computeParity", () => {
  it("returns 0 when all features have no compliance data", () => {
    const a = area("auth", [feature("auth.a"), feature("auth.b")]);
    const report = computeParity([a], {});
    expect(report.overall).toBe(0);
    expect(report.perLanguage.javascript).toBe(0);
  });

  it("treats not_applicable as excluded from the denominator", () => {
    const a = area("auth", [feature("auth.a")]);
    // js: implemented, others: not_implemented (from empty map) -> 1/7
    const c = compliance("javascript", { "auth.a": "implemented" });
    const report = computeParity([a], c);
    expect(report.overall).toBeCloseTo(1 / 7, 6);
    expect(report.perLanguage.javascript).toBeCloseTo(1, 6);
    expect(report.perLanguage.swift).toBeCloseTo(0, 6);
  });

  it("excludes not_applicable from feature parity", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": { status: "implemented" } },
      flutter: { "auth.a": { status: "implemented" } },
      go: { "auth.a": { status: "not_applicable" } },
    };
    // applicable: 6 (go excluded), implemented: 2 -> 2/6
    const report = computeParity([a], c);
    expect(report.overall).toBeCloseTo(2 / 6, 6);
    expect(report.perArea.auth).toBeCloseTo(2 / 6, 6);
  });

  it("counts partially_implemented as implemented for parity", () => {
    const a = area("auth", [feature("auth.a")]);
    const c = compliance("javascript", { "auth.a": "partially_implemented" });
    const report = computeParity([a], c);
    expect(report.perLanguage.javascript).toBeCloseTo(1, 6);
  });
});
