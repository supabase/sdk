import type { SchemaFilterProps } from "./common.ts";

/**
 * The query tree of every view and materialized view in the filtered schemas,
 * plus every view they read from in any schema, with the `NOT NULL` columns
 * each one references. `inferNonNullViewColumns` resolves view column
 * nullability from it.
 */
export const VIEW_DEFINITIONS_SQL = (props: SchemaFilterProps) => /* SQL */ `
WITH RECURSIVE view_closure(oid) AS (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE
    ${props.schemaFilter ? `n.nspname ${props.schemaFilter} AND` : ""}
    c.relkind IN ('v', 'm')
  UNION
  SELECT dep.refobjid
  FROM view_closure vc
  JOIN pg_rewrite r ON r.ev_class = vc.oid AND r.rulename = '_RETURN'
  JOIN pg_depend dep ON dep.classid = 'pg_rewrite' :: regclass
    AND dep.objid = r.oid
    AND dep.refclassid = 'pg_class' :: regclass
  JOIN pg_class rc ON rc.oid = dep.refobjid AND rc.relkind IN ('v', 'm')
)
SELECT
  r.ev_class :: int8 AS view_id,
  r.ev_action :: text AS definition,
  COALESCE(
    (
      SELECT json_agg(json_build_array(dep.refobjid :: int8, dep.refobjsubid))
      FROM pg_depend dep
      JOIN pg_attribute a ON a.attrelid = dep.refobjid AND a.attnum = dep.refobjsubid
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE dep.classid = 'pg_rewrite' :: regclass
        AND dep.objid = r.oid
        AND dep.refclassid = 'pg_class' :: regclass
        AND dep.refobjsubid > 0
        AND (a.attnotnull OR t.typtype = 'd' AND t.typnotnull)
    ),
    '[]'
  ) AS non_null_columns
FROM view_closure vc
JOIN pg_rewrite r ON r.ev_class = vc.oid AND r.rulename = '_RETURN'
`;
