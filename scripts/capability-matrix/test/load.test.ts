import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadAreas } from "../src/load";

const here = dirname(fileURLToPath(import.meta.url));
const validDir = join(here, "fixtures", "valid");

describe("loadAreas", () => {
  it("loads and parses every .yaml file in a directory", () => {
    const { areas, findings } = loadAreas(validDir);
    expect(findings).toEqual([]);
    expect(areas).toHaveLength(1);
    expect(areas[0].area.area).toBe("auth");
    expect(areas[0].area.features[0].id).toBe("auth.sign-in-with-otp");
    expect(areas[0].file.endsWith("auth.yaml")).toBe(true);
  });

  it("reports a YAML parse error for malformed files and still loads valid ones", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "capmatrix-load-"));
    try {
      writeFileSync(
        join(tmpDir, "auth.yaml"),
        `area: auth\ntitle: Auth\ndescription: d\nfeatures: []\n`
      );
      writeFileSync(join(tmpDir, "bad.yaml"), ": : :\n  - [");
      const { areas, findings } = loadAreas(tmpDir);
      expect(findings.some((f) => f.level === "error" && f.message.startsWith("YAML parse error"))).toBe(true);
      expect(areas).toHaveLength(1);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
