import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { loadCodegenConfig, checkCodegenConfig } from "../src/codegen";

const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "codegen.schema.json"),
    "utf8",
  ),
);

const valid = {
  engine: { tool: "openapi-generator", version: "7.10.0" },
  specs: { storage: { source: "https://example.com/storage.yaml", version: "v1.2.3" } },
  languages: { swift: { generator: "swift5", templates: "templates/swift" } },
};

describe("checkCodegenConfig", () => {
  it("accepts a valid config", () => {
    expect(checkCodegenConfig(valid, schema)).toEqual([]);
  });

  it("rejects a config missing engine.version", () => {
    const bad = { ...valid, engine: { tool: "openapi-generator" } };
    expect(checkCodegenConfig(bad, schema).length).toBeGreaterThan(0);
  });

  it("rejects a language missing its generator", () => {
    const bad = { ...valid, languages: { swift: { templates: "templates/swift" } } };
    expect(checkCodegenConfig(bad, schema).length).toBeGreaterThan(0);
  });

  it("accepts a language without templates (stock generator)", () => {
    const cfg = { ...valid, languages: { swift: { generator: "swift6" } } };
    expect(checkCodegenConfig(cfg, schema)).toEqual([]);
  });

  it("accepts an optional targets array", () => {
    const cfg = { ...valid, targets: [{ spec: "storage", language: "swift", output: "codegen/generated/swift-storage" }] };
    expect(checkCodegenConfig(cfg, schema)).toEqual([]);
  });

  it("rejects a target missing output", () => {
    const cfg = { ...valid, targets: [{ spec: "storage", language: "swift" }] };
    expect(checkCodegenConfig(cfg, schema).length).toBeGreaterThan(0);
  });
});

describe("loadCodegenConfig", () => {
  it("parses a YAML config file", () => {
    const dir = mkdtempSync(join(tmpdir(), "codegen-"));
    const file = join(dir, "codegen.yaml");
    writeFileSync(file, "engine:\n  tool: openapi-generator\n  version: 7.10.0\nspecs:\n  storage:\n    source: x\n    version: v1\nlanguages:\n  swift:\n    generator: swift5\n    templates: templates/swift\n");
    const { config, findings } = loadCodegenConfig(file);
    expect(findings).toEqual([]);
    expect(config?.engine.version).toBe("7.10.0");
    expect(config?.specs.storage.source).toBe("x");
  });
});
