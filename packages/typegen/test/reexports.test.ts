import { describe, expect, test } from "bun:test";
import * as postgrestTypegen from "@supabase/postgrest-typegen";
import * as typegen from "../src/index.ts";

describe("postgrest-typegen re-exports", () => {
  test("introspect is the very function postgrest-typegen exports", () => {
    expect(typegen.introspect).toBe(postgrestTypegen.introspect);
  });

  test("the document version matches the generators' contract", () => {
    expect(typegen.GENERATOR_METADATA_VERSION).toBe(
      postgrestTypegen.GENERATOR_METADATA_VERSION,
    );
  });
});
