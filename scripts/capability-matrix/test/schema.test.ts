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

function sdksAllImplemented() {
  const langs = ["javascript", "flutter", "python", "swift", "csharp", "go", "kotlin"];
  return Object.fromEntries(
    langs.map((l) => [l, { status: "implemented", references: [{ repo: "supabase/x", path: "src/a.ts" }] }])
  );
}

function loaded(area: unknown): LoadedArea[] {
  return [{ file: "auth.yaml", area: area as never }];
}

describe("checkSchema", () => {
  it("accepts a well-formed area file", () => {
    const area = {
      area: "auth", title: "Authentication", description: "x",
      features: [{ id: "auth.f", name: "F", description: "d", sdks: sdksAllImplemented() }],
    };
    expect(checkSchema(loaded(area), schema)).toEqual([]);
  });

  it("rejects an implemented entry with no references", () => {
    const sdks = sdksAllImplemented();
    (sdks as Record<string, { status: string; references?: unknown }>).swift = { status: "implemented" };
    const area = {
      area: "auth", title: "Authentication", description: "x",
      features: [{ id: "auth.f", name: "F", description: "d", sdks }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });

  it("rejects references on a not_implemented entry", () => {
    const sdks = sdksAllImplemented();
    (sdks as Record<string, unknown>).swift = {
      status: "not_implemented",
      references: [{ repo: "supabase/x", path: "src/a.ts" }],
    };
    const area = {
      area: "auth", title: "Authentication", description: "x",
      features: [{ id: "auth.f", name: "F", description: "d", sdks }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });

  it("rejects a missing language key", () => {
    const sdks = sdksAllImplemented();
    delete (sdks as Record<string, unknown>).kotlin;
    const area = {
      area: "auth", title: "Authentication", description: "x",
      features: [{ id: "auth.f", name: "F", description: "d", sdks }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });

  it("rejects a path with a line-number suffix", () => {
    const sdks = sdksAllImplemented();
    (sdks as Record<string, unknown>).go = {
      status: "implemented",
      references: [{ repo: "supabase/x", path: "src/a.ts:42" }],
    };
    const area = {
      area: "auth", title: "Authentication", description: "x",
      features: [{ id: "auth.f", name: "F", description: "d", sdks }],
    };
    expect(checkSchema(loaded(area), schema).length).toBeGreaterThan(0);
  });
});
