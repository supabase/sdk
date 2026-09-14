import type { SchemaFilterProps } from "./common.ts";
import { literal } from "./pg-format.ts";

export const VIEWS_KEY_DEPENDENCIES_SQL = (
  props: SchemaFilterProps,
) => /* SQL */ `
-- Adapted from
-- https://github.com/PostgREST/postgrest/blob/f9f0f79fa914ac00c11fbf7f4c558e14821e67e2/src/PostgREST/SchemaCache.hs#L820
with recursive
pks_fks as (
  -- pk + fk referencing col
  select
    contype::text as contype,
    conname,
    array_length(conkey, 1) as ncol,
    conrelid as resorigtbl,
    col as resorigcol,
    ord
  from pg_constraint
  left join lateral unnest(conkey) with ordinality as _(col, ord) on true
  where contype IN ('p', 'f')
  union
  -- fk referenced col
  select
    concat(contype, '_ref') as contype,
    conname,
    array_length(confkey, 1) as ncol,
    confrelid,
    col,
    ord
  from pg_constraint
  left join lateral unnest(confkey) with ordinality as _(col, ord) on true
  where contype='f'
  ${props.schemaFilter ? `and connamespace::regnamespace::text ${props.schemaFilter}` : ""}
),
views as (
  select
    c.oid       as view_id,
    n.nspname   as view_schema,
    c.relname   as view_name,
    r.ev_action as view_definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_rewrite r on r.ev_class = c.oid
  where c.relkind in ('v', 'm') 
    ${props.schemaFilter ? `and n.nspname ${props.schemaFilter}` : ""}
),
transform_json as (
  select
    view_id, view_schema, view_name,
${nodeTreeToJson("view_definition::text")}::json as view_definition
  from views
),
target_entries as(
  select
    view_id, view_schema, view_name,
    json_array_elements(view_definition->0->'targetList') as entry
  from transform_json
),
results as(
  select
    view_id, view_schema, view_name,
    (entry->>'resno')::int as view_column,
    (entry->>'resorigtbl')::oid as resorigtbl,
    (entry->>'resorigcol')::int as resorigcol
  from target_entries
),
-- CYCLE detection according to PG docs: https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-CYCLE
-- Can be replaced with CYCLE clause once PG v13 is EOL.
recursion(view_id, view_schema, view_name, view_column, resorigtbl, resorigcol, is_cycle, path) as(
  select
    r.*,
    false,
    ARRAY[resorigtbl]
  from results r
  where ${props.schemaFilter ? `view_schema ${props.schemaFilter}` : "true"}
  union all
  select
    view.view_id,
    view.view_schema,
    view.view_name,
    view.view_column,
    tab.resorigtbl,
    tab.resorigcol,
    tab.resorigtbl = ANY(path),
    path || tab.resorigtbl
  from recursion view
  join results tab on view.resorigtbl=tab.view_id and view.resorigcol=tab.view_column
  where not is_cycle
),
repeated_references as(
  select
    view_id,
    view_schema,
    view_name,
    resorigtbl,
    resorigcol,
    array_agg(attname) as view_columns
  from recursion
  join pg_attribute vcol on vcol.attrelid = view_id and vcol.attnum = view_column
  group by
    view_id,
    view_schema,
    view_name,
    resorigtbl,
    resorigcol
)
select
  sch.nspname as table_schema,
  tbl.relname as table_name,
  rep.view_schema,
  rep.view_name,
  pks_fks.conname as constraint_name,
  pks_fks.contype as constraint_type,
  jsonb_agg(
    jsonb_build_object('table_column', col.attname, 'view_columns', view_columns) order by pks_fks.ord
  ) as column_dependencies
from repeated_references rep
join pks_fks using (resorigtbl, resorigcol)
join pg_class tbl on tbl.oid = rep.resorigtbl
join pg_attribute col on col.attrelid = tbl.oid and col.attnum = rep.resorigcol
join pg_namespace sch on sch.oid = tbl.relnamespace
group by sch.nspname, tbl.relname,  rep.view_schema, rep.view_name, pks_fks.conname, pks_fks.contype, pks_fks.ncol
-- make sure we only return key for which all columns are referenced in the view - no partial PKs or FKs
having ncol = array_length(array_agg(row(col.attname, view_columns) order by pks_fks.ord), 1)
`;

/**
 * One text rewrite of the `pg_node_tree` to JSON conversion: a `replace`, or
 * a global `regexp_replace` when `isRegex` is set.
 */
type NodeTreeRewrite = {
  pattern: string;
  replacement: string;
  isRegex?: boolean;
};

/**
 * The rewrites, innermost first, that turn the `pg_node_tree` text of a view
 * definition into JSON exposing only `targetList`, `resno`, `resorigtbl` and
 * `resorigcol`. Ported from PostgREST's schema cache query, which keeps them
 * as plain `replace` calls with a single `regexp_replace` for speed; the
 * order matters, and the comments carry PostgREST's reasoning.
 */
const NODE_TREE_TO_JSON_REWRITES: readonly NodeTreeRewrite[] = [
  // `<>` is pg_node_tree's null. json_typeof is too slow to special-case it,
  // so it becomes an empty list, which also keeps the node protection below
  // working for lists that start with null, such as coldefexprs whose first
  // column has no default.
  { pattern: "<>", replacement: "()" },
  // `,`, `{` and `}` are used by the JSON conversion; drop the ones that may
  // be part of column names (`{` and `}` are escaped there).
  { pattern: ",", replacement: "" },
  { pattern: "\\{", replacement: "" },
  { pattern: "\\}", replacement: "" },
  // Format the fields we need as JSON keys so the regex below leaves them.
  { pattern: " :targetList ", replacement: ',"targetList":' },
  { pattern: " :resno ", replacement: ',"resno":' },
  { pattern: " :resorigtbl ", replacement: ',"resorigtbl":' },
  { pattern: " :resorigcol ", replacement: ',"resorigcol":' },
  // Make the regex also match the node type, e.g. `{QUERY ...`.
  { pattern: "{", replacement: "{ :" },
  // Protect node lists, which start with `({` or `((`, from the greedy regex.
  // The extra `{` is removed again below.
  { pattern: "((", replacement: "{((" },
  { pattern: "({", replacement: "{({" },
  // Remove every unused field. Removal stops at `,` for the kept fields, at
  // `}` for the end of the node and at `{` for a nested node, leaving an empty
  // key for the following node.
  { pattern: " :[^}{,]+", replacement: ',"":', isRegex: true },
  // The regex also added those empty keys before `}` and `,`.
  { pattern: ',"":}', replacement: "}" },
  { pattern: ',"":,', replacement: "," },
  // Undo the node list protection.
  { pattern: "{(", replacement: "(" },
  // Every key was added with a leading `,`; the first key of an object does
  // not need it.
  { pattern: "{,", replacement: "{" },
  // pg_node_tree lists use `( )` with space separated items; JSON uses `[ ]`
  // with commas.
  { pattern: "(", replacement: "[" },
  { pattern: ")", replacement: "]" },
  { pattern: " ", replacement: "," },
];

/**
 * Render {@link NODE_TREE_TO_JSON_REWRITES} applied to `expression` as nested
 * SQL calls: the opening calls stacked, then each rewrite's arguments on the
 * line that closes it.
 */
function nodeTreeToJson(expression: string): string {
  const lines = NODE_TREE_TO_JSON_REWRITES.toReversed().map(
    (rewrite) => `    ${rewrite.isRegex ? "regexp_replace" : "replace"}(`,
  );
  lines.push(`      ${expression},`);
  NODE_TREE_TO_JSON_REWRITES.forEach((rewrite, index) => {
    const flags = rewrite.isRegex ? ", 'g'" : "";
    const closing =
      index === NODE_TREE_TO_JSON_REWRITES.length - 1 ? ")" : "),";
    lines.push(
      `      ${literal(rewrite.pattern)}, ${literal(rewrite.replacement)}${flags}${closing}`,
    );
  });
  return lines.join("\n");
}
