import { describe, it, expect } from "vitest";
import { computeParity } from "../src/report";
import type { LoadedArea, SdkEntry } from "../src/types";

const langs = ["javascript", "flutter", "python", "swift", "csharp", "go", "kotlin"] as const;

function feature(id: string, statuses: Partial<Record<(typeof langs)[number], SdkEntry["status"]>>) {
  const sdks = Object.fromEntries(
    langs.map((l) => {
      const status = statuses[l] ?? "not_implemented";
      const entry: SdkEntry = status === "implemented"
        ? { status, references: [{ repo: "supabase/x", path: "a.ts" }] }
        : { status };
      return [l, entry];
    })
  );
  return { id, name: id, description: "d", sdks };
}

describe("computeParity", () => {
  it("treats not_applicable as excluded from the denominator", () => {
    // 1 implemented, 6 not_implemented, 0 n/a -> 1/7
    const a: LoadedArea = {
      file: "auth.yaml",
      area: { area: "auth", title: "T", description: "d", features: [feature("auth.a", { javascript: "implemented" })] as never },
    };
    const report = computeParity([a]);
    expect(report.overall).toBeCloseTo(1 / 7, 6);
    expect(report.perLanguage.javascript).toBeCloseTo(1, 6);
    expect(report.perLanguage.swift).toBeCloseTo(0, 6);
  });

  it("excludes not_applicable languages from feature parity", () => {
    // implemented: js,flutter ; n/a: go ; rest not_implemented -> applicable 6, implemented 2 -> 2/6
    const a: LoadedArea = {
      file: "auth.yaml",
      area: {
        area: "auth", title: "T", description: "d",
        features: [feature("auth.a", { javascript: "implemented", flutter: "implemented", go: "not_applicable" })] as never,
      },
    };
    const report = computeParity([a]);
    expect(report.overall).toBeCloseTo(2 / 6, 6);
    expect(report.perArea.auth).toBeCloseTo(2 / 6, 6);
  });
});
