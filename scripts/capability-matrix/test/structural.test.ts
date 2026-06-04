import { describe, it, expect } from "vitest";
import { checkStructural } from "../src/structural";
import type { LoadedArea, SdkEntry } from "../src/types";

const langs = ["javascript", "flutter", "python", "swift", "csharp", "go", "kotlin"] as const;

function sdks(overrides: Partial<Record<(typeof langs)[number], SdkEntry>> = {}) {
  const base = Object.fromEntries(langs.map((l) => [l, { status: "not_implemented" }])) as Record<string, SdkEntry>;
  return { ...base, ...overrides };
}

function area(file: string, areaName: string, features: unknown[]): LoadedArea {
  return { file, area: { area: areaName, title: "T", description: "d", features: features as never } };
}

describe("checkStructural", () => {
  it("passes a clean single file", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d", sdks: sdks() },
    ]);
    expect(checkStructural([a])).toEqual([]);
  });

  it("flags area not matching filename", () => {
    const a = area("/x/storage.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d", sdks: sdks() },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("does not match filename"))).toBe(true);
  });

  it("flags id without the area prefix", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "storage.f", name: "F", description: "d", sdks: sdks() },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("must start with"))).toBe(true);
  });

  it("flags a duplicate id across files", () => {
    const a = area("/x/auth.yaml", "auth", [{ id: "auth.f", name: "F", description: "d", sdks: sdks() }]);
    const b = area("/x/auth.yaml", "auth", [{ id: "auth.f", name: "F2", description: "d", sdks: sdks() }]);
    expect(checkStructural([a, b]).some((f) => f.message.includes("duplicate feature id"))).toBe(true);
  });

  it("flags an invalid semver in since", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d", sdks: sdks({ javascript: { status: "implemented", since: "v2", references: [{ repo: "supabase/x", path: "a.ts" }] } }) },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("not valid semver"))).toBe(true);
  });

  it("warns on not_applicable without notes", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d", sdks: sdks({ go: { status: "not_applicable" } }) },
    ]);
    const findings = checkStructural([a]);
    expect(findings.some((f) => f.level === "warning" && f.message.includes("not_applicable without notes"))).toBe(true);
  });
});
