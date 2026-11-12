import type { PostgresFunction } from "../types.ts";
import { isNode, type NodeTreeValue, parseNodeTree } from "./node-tree.ts";
import {
  type QueryNullability,
  queryNullability,
  type ViewDefinitionRow,
} from "./view-nullability.ts";

/** A row of `FUNCTION_RESULTS_SQL`. */
export interface FunctionResultRow {
  function_id: number | string;
  result_columns: string[];
  comment: string | null;
  definition: string | null;
  non_null_columns: [number | string, number | string][];
}

const NOT_NULL_DIRECTIVE = /^[ \t]*@notNull(?:[ \t]+(.*?))?[ \t]*$/gm;

/**
 * Set `is_nullable` on the `table` arguments of every `RETURNS TABLE`
 * function: `false` when the last statement of a `BEGIN ATOMIC` body proves
 * the column non-null, the way view columns are inferred, or when the
 * function comment has a `@notNull` line naming it (a bare `@notNull` names
 * every column), and `true` otherwise. PostgreSQL records no nullability for
 * these columns, so without this every one of them can be null.
 */
export function applyFunctionResultNullability<T extends PostgresFunction>(
  functions: T[],
  rows: FunctionResultRow[],
  viewRows: ViewDefinitionRow[],
): T[] {
  const rowsById = new Map(rows.map((row) => [String(row.function_id), row]));
  const nullability = queryNullability(
    viewRows,
    rows.flatMap((row) => row.non_null_columns),
  );
  return functions.map((fn) => {
    const row = rowsById.get(String(fn.id));
    if (row === undefined) {
      return fn;
    }
    const named = namedNonNullColumns(row.comment);
    const inferred = new Set(
      [...inferredNonNullColumns(row, nullability)].map(
        (resno) => row.result_columns[resno - 1],
      ),
    );
    return {
      ...fn,
      args: fn.args.map((arg) =>
        arg.mode === "table"
          ? {
              ...arg,
              is_nullable: !(
                named === "all" ||
                named.has(arg.name) ||
                inferred.has(arg.name)
              ),
            }
          : arg,
      ),
    };
  });
}

/** The `resno` of the result columns the body proves non-null. */
function inferredNonNullColumns(
  row: FunctionResultRow,
  nullability: QueryNullability,
): Set<number> {
  if (row.definition === null) {
    return new Set();
  }
  try {
    const query = lastQuery(parseNodeTree(row.definition));
    return query ? nullability.nonNullOutputColumns(query) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * The query of the last statement: a `BEGIN ATOMIC` body is stored as a list
 * holding the list of its statements.
 */
function lastQuery(tree: NodeTreeValue) {
  let value: NodeTreeValue | undefined = tree;
  while (Array.isArray(value)) {
    value = value.at(-1);
  }
  return isNode(value, "QUERY") ? value : null;
}

/** The result columns the comment's `@notNull` lines name. */
function namedNonNullColumns(comment: string | null): Set<string> | "all" {
  const names = new Set<string>();
  for (const [, list] of (comment ?? "").matchAll(NOT_NULL_DIRECTIVE)) {
    if (list === undefined || list.trim() === "") {
      return "all";
    }
    for (const name of list.split(",")) {
      if (name.trim() !== "") {
        names.add(name.trim());
      }
    }
  }
  return names;
}
