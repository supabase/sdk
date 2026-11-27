import { describe, expect, test } from "bun:test";
import { GeneratorError } from "../../src/index.ts";
import {
  type Expr,
  pythonLiteral,
  renderExpr,
} from "../../src/sources/python/expr.ts";

const name = (text: string): Expr => ({ cls: "ExprName", name: text });

describe("renderExpr", () => {
  test("passes source text through", () => {
    expect(renderExpr("None")).toBe("None");
    expect(renderExpr("'POST'")).toBe("'POST'");
  });

  test("renders names, attributes and subscripts", () => {
    expect(renderExpr(name("str"))).toBe("str");
    expect(
      renderExpr({
        cls: "ExprAttribute",
        values: [name("asyncio"), name("Future")],
      }),
    ).toBe("asyncio.Future");
    expect(
      renderExpr({
        cls: "ExprSubscript",
        left: name("dict"),
        slice: {
          cls: "ExprTuple",
          elements: [name("str"), name("JSON")],
          implicit: true,
        },
      }),
    ).toBe("dict[str, JSON]");
  });

  test("renders unions, however deep", () => {
    const union = (left: Expr, right: Expr): Expr => ({
      cls: "ExprBinOp",
      left,
      operator: "|",
      right,
    });
    expect(renderExpr(union(union(name("bytes"), name("str")), "None"))).toBe(
      "bytes | str | None",
    );
  });

  test("renders tuples, lists, sets and dicts", () => {
    const elements = [name("a"), "1"];
    expect(renderExpr({ cls: "ExprTuple", elements, implicit: false })).toBe(
      "(a, 1)",
    );
    expect(renderExpr({ cls: "ExprList", elements })).toBe("[a, 1]");
    expect(renderExpr({ cls: "ExprSet", elements })).toBe("{a, 1}");
    expect(
      renderExpr({
        cls: "ExprDict",
        keys: ["'k'", name("x")],
        values: ["1", name("y")],
      }),
    ).toBe("{'k': 1, x: y}");
  });

  test("renders calls with positional, keyword and starred arguments", () => {
    expect(
      renderExpr({
        cls: "ExprCall",
        function: name("field"),
        arguments: [
          "1",
          { cls: "ExprKeyword", name: "default_factory", value: name("list") },
          { cls: "ExprVarPositional", value: name("args") },
          { cls: "ExprVarKeyword", value: name("kwargs") },
        ],
      }),
    ).toBe("field(1, default_factory=list, *args, **kwargs)");
  });

  test("renders boolean, unary, comparison and conditional expressions", () => {
    expect(
      renderExpr({
        cls: "ExprBoolOp",
        operator: "or",
        values: [name("a"), name("b")],
      }),
    ).toBe("a or b");
    expect(renderExpr({ cls: "ExprUnaryOp", operator: "-", value: "1" })).toBe(
      "-1",
    );
    expect(
      renderExpr({ cls: "ExprUnaryOp", operator: "not", value: name("a") }),
    ).toBe("not a");
    expect(
      renderExpr({
        cls: "ExprCompare",
        left: name("a"),
        operators: ["is", "<"],
        comparators: ["None", "2"],
      }),
    ).toBe("a is None < 2");
    expect(
      renderExpr({ cls: "ExprIfExp", body: "1", test: name("a"), orelse: "2" }),
    ).toBe("1 if a else 2");
  });

  test("fails on an expression class it does not know", () => {
    expect(() => renderExpr({ cls: "ExprLambda", body: "1" })).toThrow(
      GeneratorError,
    );
    expect(() => renderExpr(null as never)).toThrow(GeneratorError);
  });
});

describe("pythonLiteral", () => {
  test("reads booleans, numbers and plain strings", () => {
    expect(pythonLiteral("True")).toBe(true);
    expect(pythonLiteral("False")).toBe(false);
    expect(pythonLiteral("600")).toBe(600);
    expect(pythonLiteral("-1")).toBe(-1);
    expect(pythonLiteral("0.5")).toBe(0.5);
    expect(pythonLiteral("'POST'")).toBe("POST");
    expect(pythonLiteral('"POST"')).toBe("POST");
    expect(pythonLiteral("''")).toBe("");
    // A number in quotes is a string.
    expect(pythonLiteral("'3600'")).toBe("3600");
  });

  test("leaves every other expression as source text", () => {
    for (const source of [
      "None",
      "()",
      "{}",
      "RetryPolicy()",
      "'a\\n'",
      "b'bytes'",
      "'it''s'",
      "1_000",
      "12345678901234567890",
    ]) {
      expect(pythonLiteral(source)).toBeUndefined();
    }
  });
});
