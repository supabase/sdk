import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { run } from "../src/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const schema = JSON.parse(readFileSync(join(root, "schema", "capability-matrix.schema.json"), "utf8"));
const codegenSchema = JSON.parse(readFileSync(join(root, "schema", "codegen.schema.json"), "utf8"));

describe("run() with codegen checks", () => {
  it("flags a feature bound to a spec absent from codegen.yaml", async () => {
    const capDir = mkdtempSync(join(tmpdir(), "cap-"));
    writeFileSync(
      join(capDir, "storage.yaml"),
      "area: storage\ntitle: Storage\ndescription: d\nfeatures:\n  - id: storage.objects.upload\n    name: Upload\n    description: d\n    binding:\n      spec: ghost\n      operationId: uploadObject\n",
    );
    const cfgDir = mkdtempSync(join(tmpdir(), "cfg-"));
    const cfgPath = join(cfgDir, "codegen.yaml");
    writeFileSync(
      cfgPath,
      "engine:\n  tool: openapi-generator\n  version: 7.10.0\nspecs:\n  storage:\n    source: x\n    version: v1\nlanguages:\n  swift:\n    generator: swift5\n    templates: templates/swift\n",
    );

    const result = await run({ mode: "validate", capabilitiesDir: capDir, schema, codegenConfigPath: cfgPath, codegenSchema });
    expect(result.findings.some((f) => f.message.includes('unknown spec "ghost"'))).toBe(true);
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
