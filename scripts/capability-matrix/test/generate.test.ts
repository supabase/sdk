import { describe, it, expect } from "vitest";
import { buildGenerateArgs } from "../src/generate";
import type { CodegenConfig } from "../src/codegen";

const config: CodegenConfig = {
  engine: { tool: "openapi-generator", version: "7.10.0" },
  specs: { storage: { source: "https://example.com/storage.yaml", version: "v1" } },
  languages: {
    swift: { generator: "swift5", templates: "templates/swift", generatorProperties: { library: "urlsession", useJsonEncodable: "false" } },
  },
};

describe("buildGenerateArgs", () => {
  it("builds the generate command for a target", () => {
    const args = buildGenerateArgs(config, { spec: "storage", language: "swift", outDir: "generated/storage" });
    expect(args).toEqual([
      "generate",
      "--input-spec", "https://example.com/storage.yaml",
      "--generator-name", "swift5",
      "--output", "generated/storage",
      "--template-dir", "templates/swift",
      "--additional-properties=library=urlsession,useJsonEncodable=false",
    ]);
  });

  it("omits --additional-properties when there are none", () => {
    const bare: CodegenConfig = { ...config, languages: { swift: { generator: "swift5", templates: "templates/swift" } } };
    const args = buildGenerateArgs(bare, { spec: "storage", language: "swift", outDir: "out" });
    expect(args).not.toContain("--additional-properties");
    expect(args.some((a) => a.startsWith("--additional-properties"))).toBe(false);
  });

  it("throws on an unknown spec", () => {
    expect(() => buildGenerateArgs(config, { spec: "ghost", language: "swift", outDir: "out" })).toThrow(/unknown spec/);
  });

  it("throws on an unknown language", () => {
    expect(() => buildGenerateArgs(config, { spec: "storage", language: "cobol", outDir: "out" })).toThrow(/unknown language/);
  });

  it("omits --template-dir when the language has no templates", () => {
    const stock: CodegenConfig = {
      engine: { tool: "openapi-generator", version: "7.23.0" },
      specs: { storage: { source: "codegen/specs/storage.normalized.json", version: "v1" } },
      languages: { swift: { generator: "swift6" } },
    };
    const args = buildGenerateArgs(stock, { spec: "storage", language: "swift", outDir: "out" });
    expect(args.includes("--template-dir")).toBe(false);
    expect(args).toEqual([
      "generate",
      "--input-spec", "codegen/specs/storage.normalized.json",
      "--generator-name", "swift6",
      "--output", "out",
    ]);
  });
});
