import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkSchema } from "../src/schema";
import type { LoadedArea } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "schema", "capability-matrix.schema.json"), "utf8")
);

function loaded(area: unknown): LoadedArea[] {
  return [{ file: "auth.yaml", area: area as never }];
}

describe("checkSchema", () => {
  it("accepts a minimal valid area file", () => {
    const area = {
      area: "auth",
      title: "Authentication",
      description: "x",
      features: [{ id: "auth.sign_in.f", name: "F", description: "d" }],
    };
    expect(checkSchema(loaded(area), schema)).toEqual([]);
  });

  it("accepts a feature with an optional group", () => {
    const area = {
      area: "auth",
      title: "Authentication",
      description: "x",
      features: [{ id: "auth.sign_in.f", name: "F", description: "d", group: "sign_in" }],
    };
    expect(checkSchema(loaded(area), schema)).toEqual([]);
  });

  it("accepts an area file with groups metadata", () => {
    const area = {
      area: "auth",
      title: "Authentication",
      description: "x",
      groups: [{ id: "sign_in", title: "Sign-in / Sign-up" }],
      features: [{ id: "auth.sign_in.f", name: "F", description: "d", group: "sign_in" }],
    };
    expect(checkSchema(loaded(area), schema)).toEqual([]);
  });

  it("rejects a feature with an extra field (sdks)", () => {
    const area = {
      area: "auth",
      title: "Authentication",
      description: "x",
      features: [{ id: "auth.sign_in.f", name: "F", description: "d", sdks: {} }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });

  it("rejects a feature missing required id", () => {
    const area = {
      area: "auth",
      title: "Authentication",
      description: "x",
      features: [{ name: "F", description: "d" }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });

  it("rejects a feature id that does not match area.feature pattern", () => {
    const area = {
      area: "auth",
      title: "Authentication",
      description: "x",
      features: [{ id: "auth", name: "F", description: "d" }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });
});
