import { describe, expect, test } from "bun:test";
import {
  type Fragment,
  joinFragments,
  parameterDefaults,
  renderSignature,
  swiftLiteral,
} from "../../src/sources/swift/declaration.ts";

/**
 * A declaration as fragments. Only the kind of the name matters to the code
 * under test, so the rest of the text is one fragment.
 */
const fragments = (before: string, name: string, after: string): Fragment[] => [
  { kind: "keyword", spelling: before },
  name === "init"
    ? { kind: "keyword", spelling: name }
    : { kind: "identifier", spelling: name },
  { kind: "text", spelling: after },
];

const defaultsOf = (after: string, name = "f"): (string | undefined)[] =>
  parameterDefaults(fragments("func ", name, after));

describe("parameterDefaults", () => {
  test("is undefined for a parameter the caller must pass", () => {
    expect(defaultsOf("(a: Int, _ b: String)")).toEqual([undefined, undefined]);
  });

  test("reads the default expression as written", () => {
    expect(
      defaultsOf(
        "(a: Int = 1, b: Options = .init(), c: String? = nil) async throws -> Int",
      ),
    ).toEqual(["1", ".init()", "nil"]);
  });

  test("does not split on commas inside brackets, generics or strings", () => {
    expect(
      defaultsOf(
        '(a: [String: Int] = ["a": 1, "b": 2], b: Result<Int, Error> = .success(1), c: String = ", ", d: (Int, Int) -> Void = { _, _ in }, e: Int)',
      ),
    ).toEqual([
      '["a": 1, "b": 2]',
      ".success(1)",
      '", "',
      "{ _, _ in }",
      undefined,
    ]);
  });

  test("reads a default that calls a function with labels", () => {
    expect(
      defaultsOf(
        '(logger: Logger = makeLogger(label: "io.supabase", level: .info), b: Bool = false)',
      ),
    ).toEqual(['makeLogger(label: "io.supabase", level: .info)', "false"]);
  });

  test("handles a string with an escaped quote and a parenthesis", () => {
    expect(defaultsOf('(a: String = "say \\"hi\\" :)", b: Int = 2)')).toEqual([
      '"say \\"hi\\" :)"',
      "2",
    ]);
  });

  test("does not take a comparison for generic brackets", () => {
    expect(defaultsOf("(a: Bool = 1 < 2, b: Bool = 3 > 2)")).toEqual([
      "1 < 2",
      "3 > 2",
    ]);
  });

  test("does not take the arrow of a closure type for a bracket", () => {
    expect(
      defaultsOf("(a: Array<(Int) -> Void> = [], b: ((Int) -> Void)? = nil)"),
    ).toEqual(["[]", "nil"]);
  });

  test("finds the clause after a generic clause and after `init`", () => {
    expect(
      defaultsOf("<T>(as _: T.Type = T.self, b: Int) -> T where T : Decodable"),
    ).toEqual(["T.self", undefined]);
    expect(defaultsOf('?(rawValue: String = "a")', "init")).toEqual(['"a"']);
  });

  test("skips the parentheses of an attribute before the name", () => {
    expect(
      parameterDefaults([
        { kind: "attribute", spelling: "@available" },
        { kind: "text", spelling: "(*, deprecated) " },
        ...fragments("func ", "f", "(a: Int = 1)"),
      ]),
    ).toEqual(["1"]);
  });

  test("is empty for an empty clause and for a declaration without one", () => {
    expect(defaultsOf("()")).toEqual([]);
    expect(defaultsOf("( )")).toEqual([]);
    expect(parameterDefaults([{ kind: "keyword", spelling: "var" }])).toEqual(
      [],
    );
  });

  test("fails on a clause that never closes, rather than guessing", () => {
    expect(() => defaultsOf("(a: Int = (1")).toThrow(
      "Unbalanced parameter clause",
    );
    expect(() => defaultsOf('(a: String = "never closed)')).toThrow(
      "Unbalanced parameter clause",
    );
  });
});

describe("joinFragments", () => {
  test("puts a declaration that the source wraps on one line", () => {
    expect(
      joinFragments([
        {
          kind: "text",
          spelling:
            "init(a: Duration = Configuration\n      .defaultInterval,\n   b: Int = 1 +\n      2)",
        },
      ]),
    ).toBe("init(a: Duration = Configuration.defaultInterval, b: Int = 1 + 2)");
  });
});

describe("renderSignature", () => {
  const eq = fragments("func ", "eq", "(_ column: String) -> Query<Phase>");

  test("is the declaration when nothing constrains it", () => {
    expect(renderSignature(eq, [])).toBe(
      "func eq(_ column: String) -> Query<Phase>",
    );
  });

  test("adds the constraints of the extension the member is in", () => {
    expect(
      renderSignature(eq, [
        { kind: "conformance", lhs: "Phase", rhs: "Filterable" },
        { kind: "sameType", lhs: "Row", rhs: "Note" },
        { kind: "superclass", lhs: "Owner", rhs: "Base" },
      ]),
    ).toBe(
      "func eq(_ column: String) -> Query<Phase> where Phase: Filterable, Row == Note, Owner: Base",
    );
  });

  test("merges them into the declaration's own where clause, once each", () => {
    const decode = fragments(
      "func ",
      "decode",
      "<T>() -> [T] where T : Decodable, Element == Note",
    );
    expect(
      renderSignature(decode, [
        { kind: "sameType", lhs: "Element", rhs: "Note" },
        { kind: "conformance", lhs: "Element", rhs: "Sendable" },
      ]),
    ).toBe(
      "func decode<T>() -> [T] where T: Decodable, Element == Note, Element: Sendable",
    );
  });
});

describe("swiftLiteral", () => {
  test("reads booleans, numbers and plain strings", () => {
    expect(swiftLiteral("true")).toBe(true);
    expect(swiftLiteral("false")).toBe(false);
    expect(swiftLiteral("600")).toBe(600);
    expect(swiftLiteral("-1")).toBe(-1);
    expect(swiftLiteral("0.5")).toBe(0.5);
    expect(swiftLiteral('", "')).toBe(", ");
    expect(swiftLiteral('""')).toBe("");
  });

  test("leaves every other expression as source text", () => {
    for (const source of [
      "nil",
      ".init()",
      "[:]",
      "T.self",
      '"a\\n"',
      '"\\(name)"',
      "1_000",
      "0x1F",
      "12345678901234567890",
    ]) {
      expect(swiftLiteral(source)).toBeUndefined();
    }
  });
});
