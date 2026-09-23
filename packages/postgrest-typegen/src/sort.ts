/**
 * Canonical ordering pass for {@link GeneratorMetadata}.
 *
 * The language generators consume the metadata collections in array order.
 * This pass is the single, generator-agnostic stabilizer: it returns a new
 * `GeneratorMetadata` whose every collection is ordered so that any producer
 * (the bundled SQL `introspect()` or a custom injected adapter) yields
 * byte-stable codegen. Generators document that they expect input pre-sorted
 * with this function; ordering is intentionally NOT enforced inside
 * `introspect()` so the concern lives in one place.
 *
 * **The TypeScript generator is the source of truth for ordering.** The keys
 * below replicate the sorts that `generateTypescript` historically applied
 * internally (schemas/tables/views/functions/types/columns/relationships by
 * name; function args by name), so that generator can drop its own sorting and
 * stay byte-identical. The other generators then inherit the same canonical
 * order for free.
 *
 * Keys are **semantic** (schema + name + signature), never oid: equivalent
 * databases assign different oids, so an oid sort would still churn output
 * across environments. `id` is only a final tie-breaker for a total order.
 *
 * Composite type `attributes` and enum values are left untouched — their order
 * is semantically meaningful (struct field / enum-label order) and must be
 * preserved. Function `args` are sorted by name because PostgREST RPC args are
 * addressed by name (the generated type is an object), matching TypeScript.
 */
import type { GeneratorMetadata, PostgresRelationship } from "./types.ts";
import { compareStrings } from "./collation.ts";

// Relations (tables/views/materialized views/foreign tables) and types share a
// (schema, name) identity within a database; `id` breaks any residual tie.
const bySchemaName = (
  a: { schema: string; name: string; id: number },
  b: { schema: string; name: string; id: number },
): number =>
  compareStrings(a.schema, b.schema) ||
  compareStrings(a.name, b.name) ||
  a.id - b.id;

// Column lists compare as their JSON text, matching the TypeScript generator's
// historical `relationships.sort`.
const compareColumns = (a: string[], b: string[]): number =>
  compareStrings(JSON.stringify(a), JSON.stringify(b));

// The first three keys mirror the TypeScript generator's historical
// `relationships.sort`. They are not total: `expandViewRelationships` in
// `introspection/relationships.ts` copies one foreign key onto every view
// exposing it, on either side, and onto every combination of view columns
// carrying it. View-to-table copies share the referenced side and differ in
// `schema`, `relation` and `columns`; table-to-view copies onto same-named
// views in different schemas differ only in `referenced_schema`. The remaining
// keys order those copies, since the view key dependency query does not order
// the view columns it aggregates.
const byRelationship = (
  a: PostgresRelationship,
  b: PostgresRelationship,
): number =>
  compareStrings(a.foreign_key_name, b.foreign_key_name) ||
  compareStrings(a.referenced_relation, b.referenced_relation) ||
  compareColumns(a.referenced_columns, b.referenced_columns) ||
  compareStrings(a.referenced_schema, b.referenced_schema) ||
  compareStrings(a.schema, b.schema) ||
  compareStrings(a.relation, b.relation) ||
  compareColumns(a.columns, b.columns);

/**
 * Return a new {@link GeneratorMetadata} with every collection ordered by a
 * stable, total, semantic key (matching the TypeScript generator's ordering).
 * Pure (does not mutate the input) and idempotent. Apply this after
 * introspection and before any `generate*` call.
 */
export function sortGeneratorMetadata(
  metadata: GeneratorMetadata,
): GeneratorMetadata {
  return {
    version: metadata.version,
    schemas: [...metadata.schemas].sort(
      (a, b) => compareStrings(a.name, b.name) || a.id - b.id,
    ),
    tables: [...metadata.tables].sort(bySchemaName),
    foreignTables: [...metadata.foreignTables].sort(bySchemaName),
    views: [...metadata.views].sort(bySchemaName),
    materializedViews: [...metadata.materializedViews].sort(bySchemaName),
    // Group columns by their table's (schema, name); name-order within a table
    // (matches the TypeScript generator's per-table `columns.sort(by name)`).
    columns: [...metadata.columns].sort(
      (a, b) =>
        compareStrings(a.schema, b.schema) ||
        compareStrings(a.table, b.table) ||
        compareStrings(a.name, b.name),
    ),
    // Grouped by table like `columns`; within a table the SQL's declared
    // column order (`array_position(indkey, attnum)`) is preserved by the
    // stable sort, since composite key order is meaningful.
    primaryKeys: [...metadata.primaryKeys].sort(
      (a, b) =>
        compareStrings(a.schema, b.schema) ||
        compareStrings(a.table_name, b.table_name),
    ),
    relationships: [...metadata.relationships].sort(byRelationship),
    // Functions can overload, so the signature is part of the identity. Args
    // are addressed by name in generated RPC types, so sort them by name too.
    functions: [...metadata.functions]
      .sort(
        (a, b) =>
          compareStrings(a.schema, b.schema) ||
          compareStrings(a.name, b.name) ||
          compareStrings(
            a.identity_argument_types,
            b.identity_argument_types,
          ) ||
          a.id - b.id,
      )
      .map((fn) => ({
        ...fn,
        args: [...fn.args].sort((a, b) => compareStrings(a.name, b.name)),
      })),
    types: [...metadata.types].sort(bySchemaName),
  };
}
