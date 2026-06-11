import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFileSync } from "node:fs";
import { run } from "../src/cli";

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "schema", "capability-matrix.schema.json"), "utf8")
);

function tempCapabilities(yamlByName: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "capmatrix-"));
  const capDir = join(dir, "capabilities");
  mkdirSync(capDir);
  for (const [name, body] of Object.entries(yamlByName)) writeFileSync(join(capDir, name), body);
  return capDir;
}

// Minimal valid feature YAML (no sdks field — features are schema-only since compliance redesign)
const validFeature = `  - id: auth.a\n    name: A\n    description: d`;
const validAuthYaml = `area: auth\ntitle: Auth\ndescription: d\nfeatures:\n${validFeature}\n`;

describe("run", () => {
  it("returns 0 errors for a valid matrix in validate mode", async () => {
    const capDir = tempCapabilities({ "auth.yaml": validAuthYaml });
    const result = await run({ mode: "validate", capabilitiesDir: capDir, schema });
    rmSync(join(capDir, ".."), { recursive: true, force: true });
    expect(result.errorCount).toBe(0);
  });

  it("returns errors for a schema-invalid matrix", async () => {
    // Missing required 'id' field on feature — violates schema
    const capDir = tempCapabilities({
      "auth.yaml": `area: auth\ntitle: Auth\ndescription: d\nfeatures:\n  - name: A\n    description: d\n`,
    });
    const result = await run({ mode: "validate", capabilitiesDir: capDir, schema });
    rmSync(join(capDir, ".."), { recursive: true, force: true });
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("produces a parity report in report mode", async () => {
    const capDir = tempCapabilities({ "auth.yaml": validAuthYaml });
    const result = await run({ mode: "report", capabilitiesDir: capDir, schema });
    rmSync(join(capDir, ".."), { recursive: true, force: true });
    // With no compliance data, all languages default to not_implemented so parity is 0
    expect(result.report?.overall).toBe(0);
  });
});
