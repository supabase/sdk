import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { checkConformance } from "../src/conformance";

const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "conformance.schema.json"),
    "utf8",
  ),
);

function makeDir(files: Record<string, string>): string {
  const tmp = mkdtempSync(join(tmpdir(), "conf-"));
  for (const [rel, content] of Object.entries(files)) {
    const parts = rel.split("/");
    if (parts.length > 1) mkdirSync(join(tmp, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(tmp, rel), content);
  }
  return tmp;
}

const validVector = "feature: storage.objects.upload\ncases:\n  - name: uploads a small file\n    input: { path: a.txt, body: hi }\n    expected: { status: 200 }\n";

describe("checkConformance", () => {
  it("passes when a vector is well-formed and references a known feature", () => {
    const dir = makeDir({ "storage/upload.yaml": validVector });
    expect(checkConformance(dir, new Set(["storage.objects.upload"]), schema)).toEqual([]);
  });

  it("errors when a vector references an unknown feature", () => {
    const dir = makeDir({ "storage/upload.yaml": validVector });
    const findings = checkConformance(dir, new Set(["storage.objects.list"]), schema);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("storage.objects.upload");
  });

  it("errors when a vector is malformed (missing cases)", () => {
    const dir = makeDir({ "storage/bad.yaml": "feature: storage.objects.upload\n" });
    expect(checkConformance(dir, new Set(["storage.objects.upload"]), schema).length).toBeGreaterThan(0);
  });

  it("returns empty when the conformance directory does not exist", () => {
    expect(checkConformance("/nonexistent/conf-xyzzy", new Set(), schema)).toEqual([]);
  });
});
