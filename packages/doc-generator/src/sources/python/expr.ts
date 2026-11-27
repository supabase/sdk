import { GeneratorError } from "../../errors.ts";

/**
 * An expression in a `griffe dump`: an annotation, a default value, a base
 * class. A string is source text as written (a name, a literal); an object is
 * a node of griffe's expression tree, tagged by `cls`.
 */
export type Expr = string | ExprNode;

export interface ExprNode {
  readonly cls: string;
  readonly [field: string]: unknown;
}

const isNode = (value: unknown): value is ExprNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ExprNode).cls === "string";

/** Reads a field that holds one expression. */
const one = (node: ExprNode, field: string): string =>
  renderExpr(node[field] as Expr);

/** Reads a field that holds a list of expressions. */
const many = (node: ExprNode, field: string): string[] =>
  (node[field] as Expr[]).map(renderExpr);

const RENDERERS: Readonly<Record<string, (node: ExprNode) => string>> = {
  ExprName: (node) => String(node.name),
  ExprAttribute: (node) => many(node, "values").join("."),
  ExprSubscript: (node) => `${one(node, "left")}[${one(node, "slice")}]`,
  ExprTuple: (node) =>
    node.implicit
      ? many(node, "elements").join(", ")
      : `(${many(node, "elements").join(", ")})`,
  ExprList: (node) => `[${many(node, "elements").join(", ")}]`,
  ExprSet: (node) => `{${many(node, "elements").join(", ")}}`,
  ExprDict: (node) => {
    const values = many(node, "values");
    return `{${many(node, "keys")
      .map((key, index) => `${key}: ${values[index] ?? ""}`)
      .join(", ")}}`;
  },
  ExprBinOp: (node) =>
    `${one(node, "left")} ${String(node.operator)} ${one(node, "right")}`,
  ExprBoolOp: (node) => many(node, "values").join(` ${String(node.operator)} `),
  ExprUnaryOp: (node) => {
    const operator = String(node.operator);
    return `${operator}${operator === "not" ? " " : ""}${one(node, "value")}`;
  },
  ExprCompare: (node) => {
    const comparators = many(node, "comparators");
    return [
      one(node, "left"),
      ...(node.operators as string[]).map(
        (operator, index) => `${operator} ${comparators[index] ?? ""}`,
      ),
    ].join(" ");
  },
  ExprIfExp: (node) =>
    `${one(node, "body")} if ${one(node, "test")} else ${one(node, "orelse")}`,
  ExprCall: (node) =>
    `${one(node, "function")}(${many(node, "arguments").join(", ")})`,
  ExprKeyword: (node) => `${String(node.name)}=${one(node, "value")}`,
  ExprVarPositional: (node) => `*${one(node, "value")}`,
  ExprVarKeyword: (node) => `**${one(node, "value")}`,
};

/**
 * Renders an expression back to Python source. The expression classes that
 * signatures use are covered. Any other class is an error rather than a
 * placeholder, so a new griffe version cannot quietly change the output.
 */
export function renderExpr(expr: Expr): string {
  if (typeof expr === "string") {
    return expr;
  }
  const render = isNode(expr) ? RENDERERS[expr.cls] : undefined;
  if (render === undefined) {
    throw new GeneratorError(
      `Cannot render the griffe expression ${JSON.stringify(expr).slice(0, 120)}`,
    );
  }
  return render(expr);
}

/**
 * A Python literal as a JSON scalar: `'POST'` is the string `POST`, `600` a
 * number, `True` a boolean. Anything else, `None` included, is `undefined`
 * and stays source text.
 */
export function pythonLiteral(
  source: string,
): string | number | boolean | undefined {
  if (source === "True" || source === "False") {
    return source === "True";
  }
  if (/^-?\d+(\.\d+)?$/.test(source)) {
    const number = Number(source);
    return Number.isSafeInteger(number) || source.includes(".")
      ? number
      : undefined;
  }
  // A string with an escape or a prefix is not worth interpreting here.
  const quoted = /^(['"])([^'"\\]*)\1$/.exec(source);
  return quoted?.[2];
}
