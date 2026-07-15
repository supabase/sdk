import { describe, it, expect } from "vitest";
import { computeParity } from "../src/report";
import type { ComplianceMap, Language, LoadedArea } from "../src/types";

function feature(id: string) {
  return { id, name: id, description: "d" };
}

function area(id: string, features: ReturnType<typeof feature>[]): LoadedArea {
  return { file: "auth.yaml", area: { area: id, title: "T", description: "d", features } };
}

function entry(status: string, symbols?: string[]) {
  return symbols ? { status: status as never, symbols } : { status: status as never };
}

describe("computeParity — strict overall/perArea (core langs only)", () => {
  it("returns 0 overall when all features have no compliance data", () => {
    const a = area("auth", [feature("auth.a"), feature("auth.b")]);
    const report = computeParity([a], {});
    expect(report.overall).toBe(0);
    expect(report.perLanguage.javascript).toBe(0);
  });

  it("passes a feature only when every core lang is exactly implemented", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented") },
      flutter: { "auth.a": entry("implemented") },
      python: { "auth.a": entry("implemented") },
      swift: { "auth.a": entry("implemented") },
    };
    const report = computeParity([a], c);
    expect(report.overall).toBe(1);
    expect(report.perArea.auth).toBe(1);
  });

  it("ignores csharp/go/kotlin status entirely for the strict pass check", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented") },
      flutter: { "auth.a": entry("implemented") },
      python: { "auth.a": entry("implemented") },
      swift: { "auth.a": entry("implemented") },
      csharp: { "auth.a": entry("not_implemented") },
      go: { "auth.a": entry("not_implemented") },
      kotlin: { "auth.a": entry("not_implemented") },
    };
    const report = computeParity([a], c);
    expect(report.overall).toBe(1);
    // but csharp/go/kotlin still get their own (low) completion score
    expect(report.perLanguage.csharp).toBe(0);
  });

  it("fails a feature when a core lang is only partially_implemented", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented") },
      flutter: { "auth.a": entry("implemented") },
      python: { "auth.a": entry("implemented") },
      swift: { "auth.a": entry("partially_implemented") },
    };
    const report = computeParity([a], c);
    expect(report.overall).toBe(0);
  });

  it("excludes a core lang marked not_applicable from the pass check", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented") },
      flutter: { "auth.a": entry("implemented") },
      python: { "auth.a": entry("implemented") },
      swift: { "auth.a": entry("not_applicable") },
    };
    const report = computeParity([a], c);
    expect(report.overall).toBe(1);
  });

  it("fails a feature that is not_applicable in every core lang", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("not_applicable") },
      flutter: { "auth.a": entry("not_applicable") },
      python: { "auth.a": entry("not_applicable") },
      swift: { "auth.a": entry("not_applicable") },
    };
    const report = computeParity([a], c);
    expect(report.overall).toBe(0);
  });

  it("computes overall as passing features / total features across a mixed fixture", () => {
    const a = area("auth", [feature("auth.a"), feature("auth.b")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented"), "auth.b": entry("implemented") },
      flutter: { "auth.a": entry("implemented"), "auth.b": entry("not_implemented") },
      python: { "auth.a": entry("implemented"), "auth.b": entry("implemented") },
      swift: { "auth.a": entry("implemented"), "auth.b": entry("implemented") },
    };
    // auth.a passes (all core implemented), auth.b fails (flutter not_implemented) -> 1/2
    const report = computeParity([a], c);
    expect(report.overall).toBe(0.5);
    expect(report.perArea.auth).toBe(0.5);
  });
});

describe("computeParity — perLanguage (unchanged, all 7 langs)", () => {
  it("treats not_applicable as excluded from that language's own denominator", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented") },
    };
    const report = computeParity([a], c);
    expect(report.perLanguage.javascript).toBeCloseTo(1, 6);
    expect(report.perLanguage.swift).toBeCloseTo(0, 6);
  });

  it("counts partially_implemented as implemented for a language's own score", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("partially_implemented") },
    };
    const report = computeParity([a], c);
    expect(report.perLanguage.javascript).toBeCloseTo(1, 6);
  });
});

describe("computeParity — coverageScope", () => {
  it("is 0 when there are no done cells at all", () => {
    const a = area("auth", [feature("auth.a")]);
    const report = computeParity([a], {});
    expect(report.coverageScope).toBe(0);
  });

  it("is the fraction of done core-lang cells that have symbols listed", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented", ["Foo.bar"]) },
      flutter: { "auth.a": entry("implemented") }, // done, no symbols
      python: { "auth.a": entry("not_implemented") }, // not done, doesn't count
      swift: { "auth.a": entry("partially_implemented", ["Bar.baz"]) }, // partial doesn't count as done
    };
    // done cells: javascript, flutter (2); with symbols: javascript (1) -> 1/2
    const report = computeParity([a], c);
    expect(report.coverageScope).toBeCloseTo(1 / 2, 6);
  });

  it("excludes partially_implemented entirely from coverage scope, even with symbols", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("partially_implemented", ["Foo.bar"]) },
    };
    const report = computeParity([a], c);
    expect(report.coverageScope).toBe(0);
  });

  it("ignores csharp/go/kotlin cells even if they have symbols", () => {
    const a = area("auth", [feature("auth.a")]);
    const c: Partial<Record<Language, ComplianceMap>> = {
      javascript: { "auth.a": entry("implemented") }, // done, no symbols
      csharp: { "auth.a": entry("implemented", ["Csharp.Foo"]) },
    };
    // only javascript counts as a core done cell -> 0/1
    const report = computeParity([a], c);
    expect(report.coverageScope).toBe(0);
  });
});
