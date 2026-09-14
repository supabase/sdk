import type { SchemaFilterProps } from "./common.ts";

export const FOREIGN_TABLES_SQL = (props: SchemaFilterProps) => /* SQL */ `
SELECT
  c.oid :: int8 AS id,
  n.nspname AS schema,
  c.relname AS name,
  obj_description(c.oid) AS comment
FROM
  pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE
  ${props.schemaFilter ? `n.nspname ${props.schemaFilter} AND` : ""}
  c.relkind = 'f'
`;
