import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { checkSchema } from "../src/schema";
import type { LoadedArea } from "../src/types";

const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "capability-matrix.schema.json"),
    "utf8",
  ),
);

function area(features: unknown[]): LoadedArea {
  return { file: "/x/storage.yaml", area: { area: "storage", title: "T", description: "d", features: features as never } };
}

describe("feature binding schema", () => {
  it("accepts a feature with a valid binding", () => {
    const a = area([
      { id: "storage.objects.upload", name: "Upload", description: "d", binding: { spec: "storage", operationId: "uploadObject" } },
    ]);
    expect(checkSchema([a], schema)).toEqual([]);
  });

  it("rejects a binding missing operationId", () => {
    const a = area([
      { id: "storage.objects.upload", name: "Upload", description: "d", binding: { spec: "storage" } },
    ]);
    expect(checkSchema([a], schema).length).toBeGreaterThan(0);
  });

  it("rejects a binding with an unknown property", () => {
    const a = area([
      { id: "storage.objects.upload", name: "Upload", description: "d", binding: { spec: "storage", operationId: "uploadObject", extra: true } },
    ]);
    expect(checkSchema([a], schema).length).toBeGreaterThan(0);
  });
});
