import { describe, expect, test } from "bun:test";

import { literal } from "../../src/introspection/sql/pg-format.ts";

/**
 * Pins the inlined `literal` helper to the exact output of `pg-format@1.0.4`
 * (the dependency it replaces). Expected values were captured from the real
 * package, so any drift here would also be drift from postgres-meta's SQL.
 */
describe("literal", () => {
  test("renders null and undefined as NULL", () => {
    expect(literal(null)).toBe("NULL");
    expect(literal(undefined)).toBe("NULL");
  });

  test("quotes numbers as string literals, like pg-format does", () => {
    // pg-format does NOT special-case numbers: `limit '10'` is what
    // postgres-meta emits, and Postgres coerces the literal to bigint.
    expect(literal(0)).toBe("'0'");
    expect(literal(10)).toBe("'10'");
    expect(literal(-42)).toBe("'-42'");
    expect(literal(3.14)).toBe("'3.14'");
    expect(literal(1e21)).toBe("'1e+21'");
    expect(literal(Number.POSITIVE_INFINITY)).toBe("'Infinity'");
    expect(literal(Number.NEGATIVE_INFINITY)).toBe("'-Infinity'");
    expect(literal(Number.NaN)).toBe("'NaN'");
    expect(literal(BigInt(123))).toBe("'123'");
  });

  test("single-quotes strings and doubles embedded quotes", () => {
    expect(literal("")).toBe("''");
    expect(literal("public")).toBe("'public'");
    expect(literal("it's")).toBe("'it''s'");
    expect(literal("' OR '1'='1")).toBe("''' OR ''1''=''1'");
    expect(literal("1'; DROP TABLE users; --")).toBe(
      "'1''; DROP TABLE users; --'",
    );
    expect(literal('with "double" quotes')).toBe("'with \"double\" quotes'");
  });

  test("switches to an E'' string and doubles backslashes", () => {
    expect(literal("a\\b")).toBe("E'a\\\\b'");
    expect(literal("back\\slash 'q'")).toBe("E'back\\\\slash ''q'''");
  });

  test("renders booleans as 't' / 'f'", () => {
    expect(literal(true)).toBe("'t'");
    expect(literal(false)).toBe("'f'");
  });

  test("renders dates in Postgres ISO 8601 form", () => {
    expect(literal(new Date("2024-01-01T00:00:00Z"))).toBe(
      "'2024-01-01 00:00:00.000+00'",
    );
  });

  test("renders arrays as comma-separated literals and nested arrays as groups", () => {
    expect(literal([1, 2, 3])).toBe("'1','2','3'");
    expect(literal(["a", "b"])).toBe("'a','b'");
    expect(literal([])).toBe("");
    expect(
      literal([
        [1, 2],
        [3, 4],
      ]),
    ).toBe("('1', '2'), ('3', '4')");
  });

  test("renders plain objects as jsonb literals", () => {
    expect(literal({ a: 1 })).toBe("'{\"a\":1}'::jsonb");
    expect(literal({ id: 1, name: "it's" })).toBe(
      '\'{"id":1,"name":"it\'\'s"}\'::jsonb',
    );
  });
});
