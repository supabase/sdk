import { literal } from "pg-format";
import type { SQLQueryPropsWithSchemaFilterAndIdsFilter } from "./common.ts";

export const VIEWS_SQL = (
  props: SQLQueryPropsWithSchemaFilterAndIdsFilter & {
    viewIdentifierFilter?: string;
  },
) => /* SQL */ `
SELECT
  c.oid :: int8 AS id,
  n.nspname AS schema,
  c.relname AS name,
  -- See definition of information_schema.views
  (pg_relation_is_updatable(c.oid, false) & 20) = 20 AS is_updatable,
  -- Passing include_triggers => true also counts views made writable by
  -- INSTEAD OF triggers (and INSTEAD rules), which PostgREST can write
  -- through even when the view is not auto-updatable. Bit 8 is INSERT,
  -- bit 4 is UPDATE (see information_schema.views).
  (pg_relation_is_updatable(c.oid, true) & 8) = 8 AS is_insert_enabled,
  (pg_relation_is_updatable(c.oid, true) & 4) = 4 AS is_update_enabled,
  obj_description(c.oid) AS comment
FROM
  pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE
  ${props.schemaFilter ? `n.nspname ${props.schemaFilter} AND` : ""}
  ${props.idsFilter ? `c.oid ${props.idsFilter} AND` : ""}
  ${props.viewIdentifierFilter ? `(n.nspname || '.' || c.relname) ${props.viewIdentifierFilter} AND` : ""}
  c.relkind = 'v'
${props.limit ? `limit ${literal(props.limit)}` : ""}
${props.offset ? `offset ${literal(props.offset)}` : ""}
`;
