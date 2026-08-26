import { literal } from "pg-format";
import type { SQLQueryPropsWithSchemaFilter } from "./common.ts";

export const PRIMARY_KEYS_SQL = (
  props: SQLQueryPropsWithSchemaFilter & {
    tableIdentifierFilter?: string;
  },
) => /* SQL */ `
SELECT
  c.oid :: int8 AS table_id,
  n.nspname AS schema,
  c.relname AS table_name,
  a.attname AS name
FROM
  pg_index i
  JOIN pg_class c ON i.indrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
WHERE
  ${props.schemaFilter ? `n.nspname ${props.schemaFilter} AND` : ""}
  ${props.tableIdentifierFilter ? `n.nspname || '.' || c.relname ${props.tableIdentifierFilter} AND` : ""}
  i.indisprimary
ORDER BY
  c.oid,
  array_position(i.indkey, a.attnum)
${props.limit ? `limit ${literal(props.limit)}` : ""}
${props.offset ? `offset ${literal(props.offset)}` : ""}
`;
