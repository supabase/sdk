import { describe, expect, test } from "bun:test";
import * as postgrestTypegen from "@supabase/postgrest-typegen";
import * as typegen from "../src/index.ts";

describe("postgrest-typegen re-exports", () => {
  test("introspection is passed through unchanged", () => {
    expect(typegen.introspect).toBe(postgrestTypegen.introspect);
    expect(typegen.GENERATOR_METADATA_VERSION).toBe(
      postgrestTypegen.GENERATOR_METADATA_VERSION,
    );
  });
});
