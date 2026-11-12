import type { SchemaFilterProps } from "./common.ts";

/**
 * Every `RETURNS TABLE` function in the filtered schemas with its result
 * column names in declaration order, its comment and, for a `BEGIN ATOMIC`
 * body, the body's query tree and the `NOT NULL` columns it references.
 * `applyFunctionResultNullability` resolves which result columns can never be
 * null from it.
 */
export const FUNCTION_RESULTS_SQL = (props: SchemaFilterProps) => /* SQL */ `
SELECT
  p.oid :: int8 AS function_id,
  (
    SELECT json_agg(arg.name ORDER BY arg.position)
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY
      AS arg(name, mode, position)
    WHERE arg.mode = 't'
  ) AS result_columns,
  obj_description(p.oid, 'pg_proc') AS comment,
  p.prosqlbody :: text AS definition,
  COALESCE(
    (
      SELECT json_agg(json_build_array(dep.refobjid :: int8, dep.refobjsubid))
      FROM pg_depend dep
      JOIN pg_attribute a ON a.attrelid = dep.refobjid AND a.attnum = dep.refobjsubid
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE dep.classid = 'pg_proc' :: regclass
        AND dep.objid = p.oid
        AND dep.refclassid = 'pg_class' :: regclass
        AND dep.refobjsubid > 0
        AND (a.attnotnull OR t.typtype = 'd' AND t.typnotnull)
    ),
    '[]'
  ) AS non_null_columns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE
  ${props.schemaFilter ? `n.nspname ${props.schemaFilter} AND` : ""}
  't' = ANY (p.proargmodes)
`;
