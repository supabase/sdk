import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { checkStructural, checkSpecs } from "../src/structural";
import type { LoadedArea } from "../src/types";

function area(file: string, areaName: string, features: unknown[]): LoadedArea {
  return { file, area: { area: areaName, title: "T", description: "d", features: features as never } };
}

describe("checkStructural", () => {
  it("passes a clean single file", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d" },
    ]);
    expect(checkStructural([a])).toEqual([]);
  });

  it("flags area not matching filename", () => {
    const a = area("/x/storage.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d" },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("does not match filename"))).toBe(true);
  });

  it("flags id without the area prefix", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "storage.f", name: "F", description: "d" },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("must start with"))).toBe(true);
  });

  it("flags a duplicate id across files", () => {
    const a = area("/x/auth.yaml", "auth", [{ id: "auth.f", name: "F", description: "d" }]);
    const b = area("/x/auth.yaml", "auth", [{ id: "auth.f", name: "F2", description: "d" }]);
    expect(checkStructural([a, b]).some((f) => f.message.includes("duplicate feature id"))).toBe(true);
  });
});

describe("checkSpecs", () => {
  function makeSpecsDir(files: Record<string, string>): string {
    const tmp = mkdtempSync(join(tmpdir(), "specs-"));
    for (const [rel, content] of Object.entries(files)) {
      const parts = rel.split("/");
      if (parts.length === 2) mkdirSync(join(tmp, parts[0]), { recursive: true });
      writeFileSync(join(tmp, rel), content);
    }
    return tmp;
  }

  it("passes when every spec has a matching feature id", () => {
    const dir = makeSpecsDir({ "auth/sign_up.md": "# Sign Up" });
    expect(checkSpecs(dir, new Set(["auth.sign_up"]))).toEqual([]);
  });

  it("errors on a spec with no matching feature id", () => {
    const dir = makeSpecsDir({ "auth/orphan.md": "# Orphan" });
    const findings = checkSpecs(dir, new Set(["auth.sign_up"]));
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe("error");
    expect(findings[0].message).toContain("auth.orphan");
  });

  it("passes for a known spec and errors for an orphan in the same dir", () => {
    const dir = makeSpecsDir({
      "auth/sign_up.md": "# Sign Up",
      "auth/ghost.md": "# Ghost",
    });
    const findings = checkSpecs(dir, new Set(["auth.sign_up"]));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("auth.ghost");
  });

  it("ignores non-.md files in subdirectories", () => {
    const dir = makeSpecsDir({ "auth/sign_up.md": "ok", "auth/draft.txt": "skip" });
    expect(checkSpecs(dir, new Set(["auth.sign_up"]))).toEqual([]);
  });

  it("returns empty when the specs directory does not exist", () => {
    expect(checkSpecs("/nonexistent/specs-dir-xyzzy", new Set())).toEqual([]);
  });
});
