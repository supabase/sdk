import { describe, it, expect } from "vitest";
import { checkBindings } from "../src/bindings";
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
