import type { PostgresColumn } from "../types.ts";
import {
  isNode,
  type NodeTreeNode,
  type NodeTreeValue,
  parseNodeTree,
} from "./node-tree.ts";

/** A row of `VIEW_DEFINITIONS_SQL`. */
export interface ViewDefinitionRow {
  view_id: number | string;
  definition: string;
  non_null_columns: [number | string, number | string][];
}

const RTE_RELATION = "0";
const RTE_SUBQUERY = "1";
const RTE_JOIN = "2";
const RTE_CTE = "6";
const RTE_GROUP = "9";

const JOIN_INNER = "0";
const JOIN_LEFT = "1";
const JOIN_RIGHT = "3";

const NOT_NULL_DIRECTIVE = /^\s*@notNull\s*$/m;

/**
 * Mark view and materialized view columns as not nullable when PostgreSQL can
 * prove it from the view's query tree (see {@link inferNonNullViewColumns}) or
 * when the column comment has an `@notNull` line. PostgreSQL never sets
 * `attnotnull` on view columns, so without this every one of them is nullable.
 */
export function applyViewColumnNullability<T extends PostgresColumn>(
  columns: T[],
  rows: ViewDefinitionRow[],
): T[] {
  const viewIds = new Set(rows.map((row) => String(row.view_id)));
  const nonNull = inferNonNullViewColumns(rows);
  return columns.map((column) =>
    column.is_nullable &&
    viewIds.has(String(column.table_id)) &&
    (nonNull.has(column.id) || NOT_NULL_DIRECTIVE.test(column.comment ?? ""))
      ? { ...column, is_nullable: false }
      : column,
  );
}

/**
 * The ids (`<view oid>.<attnum>`) of the view columns that can never be null.
 * A column qualifies when it is a plain reference to a `NOT NULL` column, or
 * to a view column that qualifies, followed through joins, subqueries,
 * non-recursive CTEs and `GROUP BY`, and nothing on the way puts it on the
 * nullable side of an outer join, in a set operation or under grouping sets.
 * The outer-join check walks the join tree instead of reading
 * `varnullingrels`, which PostgreSQL 15 does not have.
 */
function inferNonNullViewColumns(rows: ViewDefinitionRow[]): Set<string> {
  const definitions = new Map(
    rows.map((row) => [String(row.view_id), row.definition]),
  );
  const nonNullBaseColumns = new Set(
    rows.flatMap((row) =>
      row.non_null_columns.map(([relation, attnum]) => `${relation}.${attnum}`),
    ),
  );
  const resolved = new Map<string, Set<number>>();
  const nullableIndexesByQuery = new Map<NodeTreeNode, Set<number>>();
  const nullableIndexesOf = (query: NodeTreeNode): Set<number> => {
    let indexes = nullableIndexesByQuery.get(query);
    if (indexes === undefined) {
      indexes = nullableRangeTableIndexes(query);
      nullableIndexesByQuery.set(query, indexes);
    }
    return indexes;
  };

  const nonNullColumnsOfView = (viewId: string): Set<number> => {
    const cached = resolved.get(viewId);
    if (cached !== undefined) {
      return cached;
    }
    const columns = new Set<number>();
    resolved.set(viewId, columns);
    try {
      const tree = parseNodeTree(definitions.get(viewId) ?? "");
      const query = Array.isArray(tree) ? tree[0] : tree;
      if (isNode(query, "QUERY") && allowsNonNull(query)) {
        for (const entry of list(query.fields.targetList)) {
          if (
            isNode(entry, "TARGETENTRY") &&
            entry.fields.resjunk !== "true" &&
            isNonNullExpression(entry.fields.expr, [query])
          ) {
            columns.add(Number(entry.fields.resno));
          }
        }
      }
    } catch {
      columns.clear();
    }
    return columns;
  };

  const isNonNullColumn = (relation: string, attnum: number): boolean =>
    definitions.has(relation)
      ? nonNullColumnsOfView(relation).has(attnum)
      : nonNullBaseColumns.has(`${relation}.${attnum}`);

  const isNonNullExpression = (
    expression: NodeTreeValue | undefined,
    queries: NodeTreeNode[],
  ): boolean => {
    const query = queries.at(-1);
    if (
      query === undefined ||
      !isNode(expression, "VAR") ||
      expression.fields.varlevelsup !== "0"
    ) {
      return false;
    }
    const varno = Number(expression.fields.varno);
    const attnum = Number(expression.fields.varattno);
    if (attnum <= 0 || nullableIndexesOf(query).has(varno)) {
      return false;
    }
    const entry = list(query.fields.rtable)[varno - 1];
    if (!isNode(entry, "RANGETBLENTRY")) {
      return false;
    }
    switch (entry.fields.rtekind) {
      case RTE_RELATION:
        return (
          typeof entry.fields.relid === "string" &&
          isNonNullColumn(entry.fields.relid, attnum)
        );
      case RTE_SUBQUERY:
        return isNonNullOutput(entry.fields.subquery, attnum, queries);
      case RTE_JOIN:
        return isNonNullExpression(
          list(entry.fields.joinaliasvars)[attnum - 1],
          queries,
        );
      case RTE_GROUP:
        return isNonNullExpression(
          list(entry.fields.groupexprs)[attnum - 1],
          queries,
        );
      case RTE_CTE: {
        const levelsUp = Number(entry.fields.ctelevelsup);
        const owner = queries.at(-1 - levelsUp);
        const cte = list(owner?.fields.cteList).find(
          (candidate) =>
            isNode(candidate, "COMMONTABLEEXPR") &&
            candidate.fields.ctename === entry.fields.ctename,
        );
        return (
          isNode(cte) &&
          cte.fields.cterecursive !== "true" &&
          isNonNullOutput(
            cte.fields.ctequery,
            attnum,
            queries.slice(0, queries.length - levelsUp),
          )
        );
      }
      default:
        return false;
    }
  };

  const isNonNullOutput = (
    subquery: NodeTreeValue | undefined,
    resno: number,
    queries: NodeTreeNode[],
  ): boolean => {
    if (!isNode(subquery, "QUERY") || !allowsNonNull(subquery)) {
      return false;
    }
    const entry = list(subquery.fields.targetList).find(
      (candidate) =>
        isNode(candidate, "TARGETENTRY") &&
        Number(candidate.fields.resno) === resno,
    );
    return (
      isNode(entry) &&
      isNonNullExpression(entry.fields.expr, [...queries, subquery])
    );
  };

  const result = new Set<string>();
  for (const viewId of definitions.keys()) {
    for (const attnum of nonNullColumnsOfView(viewId)) {
      result.add(`${viewId}.${attnum}`);
    }
  }
  return result;
}

function allowsNonNull(query: NodeTreeNode): boolean {
  return (
    query.fields.setOperations === null &&
    list(query.fields.groupingSets).length === 0
  );
}

/**
 * The range table indexes that sit on the nullable side of an outer join in
 * the query's join tree, including the indexes of nested joins themselves.
 */
function nullableRangeTableIndexes(query: NodeTreeNode): Set<number> {
  const nullable = new Set<number>();
  const visit = (node: NodeTreeValue | undefined, isNullable: boolean) => {
    if (isNode(node, "RANGETBLREF")) {
      if (isNullable) {
        nullable.add(Number(node.fields.rtindex));
      }
    } else if (isNode(node, "FROMEXPR")) {
      for (const item of list(node.fields.fromlist)) {
        visit(item, isNullable);
      }
    } else if (isNode(node, "JOINEXPR")) {
      const joinType = node.fields.jointype;
      if (isNullable) {
        nullable.add(Number(node.fields.rtindex));
      }
      visit(
        node.fields.larg,
        isNullable || (joinType !== JOIN_INNER && joinType !== JOIN_LEFT),
      );
      visit(
        node.fields.rarg,
        isNullable || (joinType !== JOIN_INNER && joinType !== JOIN_RIGHT),
      );
    }
  };
  visit(query.fields.jointree, false);
  return nullable;
}

function list(value: NodeTreeValue | undefined): NodeTreeValue[] {
  return Array.isArray(value) ? value : [];
}
