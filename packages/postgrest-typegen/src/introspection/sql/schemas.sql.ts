import type { SchemaFilterProps } from "./common.ts";

export const SCHEMAS_SQL = (props: SchemaFilterProps) => /* SQL */ `
-- Adapted from information_schema.schemata
select
  n.oid::int8 as id,
  n.nspname as name,
  u.rolname as owner
from
  pg_namespace n,
  pg_roles u
where
  n.nspowner = u.oid
  ${props.schemaFilter ? `and n.nspname ${props.schemaFilter}` : ""}
  and not pg_catalog.starts_with(n.nspname, 'pg_')
  and (
    pg_has_role(n.nspowner, 'USAGE')
    or has_schema_privilege(n.oid, 'CREATE, USAGE')
  )
  and not pg_catalog.starts_with(n.nspname, 'pg_temp_')
  and not pg_catalog.starts_with(n.nspname, 'pg_toast_temp_')
`;
