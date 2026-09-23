import { describe, expect, test } from "bun:test";

import { sortEdgeFunctionsMetadata } from "../src/sort.ts";
import {
  EDGE_FUNCTIONS_METADATA_VERSION,
  type EdgeFunction,
  type EdgeFunctionsMetadata,
} from "../src/types.ts";

const fn = (slug: string, typeNames: string[] = []): EdgeFunction => ({
  slug,
  entrypoint: `supabase/functions/${slug}/index.ts`,
  importMap: null,
  verifyJwt: true,
  requestBody: null,
  responseBody: null,
  types: typeNames.map((name) => ({ name, type: { kind: "string" } })),
});

describe("sortEdgeFunctionsMetadata", () => {
  test("orders functions, declarations and diagnostics with the pinned collation", () => {
    const sorted = sortEdgeFunctionsMetadata({
      version: EDGE_FUNCTIONS_METADATA_VERSION,
      functions: [fn("z"), fn("ä", ["Zed", "Ärm", "Arm"]), fn("a")],
      diagnostics: [
        { slug: "b", path: "", message: "y" },
        { slug: "a", path: "R.b", message: "x" },
        { slug: "a", path: "R.a", message: "z" },
        { slug: "a", path: "R.a", message: "a" },
      ],
    });
    expect(sorted.functions.map((f) => f.slug)).toEqual(["a", "ä", "z"]);
    expect(sorted.functions[1]?.types.map((t) => t.name)).toEqual([
      "Arm",
      "Ärm",
      "Zed",
    ]);
    expect(sorted.diagnostics).toEqual([
      { slug: "a", path: "R.a", message: "a" },
      { slug: "a", path: "R.a", message: "z" },
      { slug: "a", path: "R.b", message: "x" },
      { slug: "b", path: "", message: "y" },
    ]);
  });

  test("does not mutate its input and is idempotent", () => {
    const input: EdgeFunctionsMetadata = {
      version: EDGE_FUNCTIONS_METADATA_VERSION,
      functions: [fn("b"), fn("a")],
      diagnostics: [],
    };
    const once = sortEdgeFunctionsMetadata(input);
    expect(input.functions.map((f) => f.slug)).toEqual(["b", "a"]);
    expect(sortEdgeFunctionsMetadata(once)).toEqual(once);
  });
});
