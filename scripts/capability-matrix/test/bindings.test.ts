import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { checkBindings, checkBindingOperations } from "../src/bindings";
import type { LoadedArea } from "../src/types";
import type { CodegenConfig } from "../src/codegen";

const config: CodegenConfig = {
  engine: { tool: "openapi-generator", version: "7.10.0" },
  specs: { storage: { source: "x", version: "v1" } },
  languages: { swift: { generator: "swift5", templates: "templates/swift" } },
};

function area(features: unknown[]): LoadedArea {
  return { file: "/x/storage.yaml", area: { area: "storage", title: "T", description: "d", features: features as never } };
}

describe("checkBindings", () => {
  it("passes when a binding references a known spec", () => {
    const a = area([
      { id: "storage.objects.upload", name: "U", description: "d", binding: { spec: "storage", operationId: "uploadObject" } },
    ]);
    expect(checkBindings([a], config)).toEqual([]);
  });

  it("ignores features without a binding", () => {
    const a = area([{ id: "storage.objects.upload", name: "U", description: "d" }]);
    expect(checkBindings([a], config)).toEqual([]);
  });

  it("errors when a binding references an unknown spec", () => {
    const a = area([
      { id: "storage.objects.upload", name: "U", description: "d", binding: { spec: "ghost", operationId: "x" } },
    ]);
    const findings = checkBindings([a], config);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('unknown spec "ghost"');
  });
});

describe("checkBindingOperations", () => {
  function specDir(operationIds: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "spec-"));
    const paths: any = {};
    operationIds.forEach((id, i) => { paths[`/op${i}`] = { get: { operationId: id } }; });
    writeFileSync(join(dir, "storage.normalized.json"), JSON.stringify({ openapi: "3.0.3", paths }));
    return dir;
  }
  const cfg: any = {
    engine: { tool: "openapi-generator", version: "7.23.0" },
    specs: { storage: { source: "storage.normalized.json", version: "v1" } },
    languages: { swift: { generator: "swift6" } },
  };
  function area(features: unknown[]): LoadedArea {
    return { file: "/x/storage.yaml", area: { area: "storage", title: "T", description: "d", features: features as never } };
  }

  it("passes when a binding's operationId exists in the spec", () => {
    const base = specDir(["uploadObject"]);
    const a = area([{ id: "storage.x.upload", name: "U", description: "d", binding: { spec: "storage", operationId: "uploadObject" } }]);
    expect(checkBindingOperations([a], cfg, base)).toEqual([]);
  });

  it("errors when the operationId is not in the spec", () => {
    const base = specDir(["uploadObject"]);
    const a = area([{ id: "storage.x.ghost", name: "G", description: "d", binding: { spec: "storage", operationId: "ghostOp" } }]);
    const findings = checkBindingOperations([a], cfg, base);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("ghostOp");
  });

  it("ignores features without a binding", () => {
    const base = specDir(["uploadObject"]);
    const a = area([{ id: "storage.x.none", name: "N", description: "d" }]);
    expect(checkBindingOperations([a], cfg, base)).toEqual([]);
  });
});
