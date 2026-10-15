/**
 * Public metadata contract for type generation.
 *
 * ArkType is the single source of truth: each `Postgres*` schema below is a
 * runtime validator, and the corresponding exported type is derived from it via
 * `.infer`. The shapes are kept identical to postgres-meta's `src/lib/types.ts`
 * so that postgres-meta can consume this package as a drop-in replacement for
 * its embedded templates (a compile-time equivalence test pins this).
 *
 * `GeneratorMetadata` is the pluggable contract: the SQL introspector is the
 * default producer, but any source able to produce this shape can feed the
 * language generators. Because the producer may be an injected adapter,
 * `parseGeneratorMetadata` is offered so integrators can validate a result at
 * runtime instead of blindly casting it. Validation is deliberately *not* baked
 * into `introspect()` — it is an opt-in helper.
 */
import { type } from "arktype";

const postgresColumnSchema = type({
  table_id: "number",
  schema: "string",
  table: "string",
  /** `<table_id>.<ordinal_position>` */
  id: "string",
  ordinal_position: "number",
  name: "string",
  default_value: "unknown",
  data_type: "string",
  format: "string",
  /**
   * Schema owning `format`'s type. Bare enum/composite/domain names are
   * ambiguous across schemas (two schemas can each define an enum named
   * `mood`); this disambiguates without changing `format` itself.
   */
  type_schema: "string",
  is_identity: "boolean",
  identity_generation: "'ALWAYS' | 'BY DEFAULT' | null",
  is_generated: "boolean",
  is_nullable: "boolean",
  is_updatable: "boolean",
  is_unique: "boolean",
  enums: "string[]",
  check: "string | null",
  comment: "string | null",
});
export type PostgresColumn = typeof postgresColumnSchema.infer;

const postgresForeignTableSchema = type({
  id: "number",
  schema: "string",
  name: "string",
  comment: "string | null",
  "columns?": postgresColumnSchema.array(),
});
export type PostgresForeignTable = typeof postgresForeignTableSchema.infer;

const postgresFunctionSchema = type({
  id: "number",
  schema: "string",
  name: "string",
  language: "string",
  definition: "string",
  complete_statement: "string",
  args: type({
    mode: "'in' | 'out' | 'inout' | 'variadic' | 'table'",
    name: "string",
    type_id: "number",
    // `introspect()` emits `null` for the OUT columns of RETURNS TABLE /
    // OUT-arg functions: the introspection SQL sizes `arg_has_defaults` from
    // the input-arg count while `arg_modes`/`arg_types` include output args,
    // so the trailing rows are padded with NULL. postgres-meta types this as a
    // plain boolean, but the opt-in validator must accept the real output.
    has_default: "boolean | null",
  }).array(),
  argument_types: "string",
  identity_argument_types: "string",
  return_type_id: "number",
  return_type: "string",
  return_type_relation_id: "number | null",
  is_set_returning_function: "boolean",
  prorows: "number | null",
  behavior: "'IMMUTABLE' | 'STABLE' | 'VOLATILE'",
  security_definer: "boolean",
  config_params: type({ "[string]": "string" }).or("null"),
});
export type PostgresFunction = typeof postgresFunctionSchema.infer;

const postgresMaterializedViewSchema = type({
  id: "number",
  schema: "string",
  name: "string",
  is_populated: "boolean",
  comment: "string | null",
  "columns?": postgresColumnSchema.array(),
});
export type PostgresMaterializedView =
  typeof postgresMaterializedViewSchema.infer;

const postgresPrimaryKeySchema = type({
  schema: "string",
  table_name: "string",
  name: "string",
  table_id: "number",
});
export type PostgresPrimaryKey = typeof postgresPrimaryKeySchema.infer;

const postgresRelationshipSchema = type({
  foreign_key_name: "string",
  schema: "string",
  relation: "string",
  columns: "string[]",
  is_one_to_one: "boolean",
  referenced_schema: "string",
  referenced_relation: "string",
  referenced_columns: "string[]",
});
export type PostgresRelationship = typeof postgresRelationshipSchema.infer;

const postgresSchemaSchema = type({
  id: "number",
  name: "string",
  owner: "string",
});
export type PostgresSchema = typeof postgresSchemaSchema.infer;

const postgresTableSchema = type({
  id: "number",
  schema: "string",
  name: "string",
  rls_enabled: "boolean",
  rls_forced: "boolean",
  replica_identity: "'DEFAULT' | 'INDEX' | 'FULL' | 'NOTHING'",
  bytes: "number",
  size: "string",
  live_rows_estimate: "number",
  dead_rows_estimate: "number",
  comment: "string | null",
  "columns?": postgresColumnSchema.array(),
});
export type PostgresTable = typeof postgresTableSchema.infer;

const postgresTypeSchema = type({
  id: "number",
  name: "string",
  schema: "string",
  format: "string",
  enums: "string[]",
  attributes: type({ name: "string", type_id: "number" }).array(),
  comment: "string | null",
  type_relation_id: "number | null",
});
export type PostgresType = typeof postgresTypeSchema.infer;

const postgresViewSchema = type({
  id: "number",
  schema: "string",
  name: "string",
  is_updatable: "boolean",
  /**
   * Whether INSERT works through this view: auto-updatable per
   * `pg_relation_is_updatable`, or made insertable by an INSTEAD OF INSERT
   * trigger or an unconditional INSTEAD rule. Tracked separately from
   * `is_updatable` (which mirrors `information_schema.views` and ignores
   * triggers). Optional because version 1 metadata predating this field is
   * still valid; consumers fall back to `is_updatable` when absent.
   */
  "is_insert_enabled?": "boolean",
  /** Same as `is_insert_enabled`, for UPDATE. */
  "is_update_enabled?": "boolean",
  comment: "string | null",
  "columns?": postgresColumnSchema.array(),
});
export type PostgresView = typeof postgresViewSchema.infer;

/**
 * A reference to a `types` entry by oid. `format` is the type's `name` (the
 * same spelling `PostgresColumn.format` uses, `_` prefixed for arrays) and
 * `type_schema` its schema; both are `null` when the type is not in `types`,
 * which never happens in a document produced by `introspect()`.
 */
const rpcTypeReferenceSchema = type({
  type_id: "number",
  format: "string | null",
  type_schema: "string | null",
});
export type RpcTypeReference = typeof rpcTypeReferenceSchema.infer;

const rpcFunctionArgSchema = rpcTypeReferenceSchema.merge({
  /** Empty for an unnamed parameter. */
  name: "string",
  mode: "'in' | 'inout' | 'variadic'",
  has_default: "boolean",
  /**
   * The relation whose row type this parameter has, when that relation is in
   * the metadata. A caller passes such a parameter as a row object.
   */
  relation_id: "number | null",
});
export type RpcFunctionArg = typeof rpcFunctionArgSchema.infer;

const rpcFunctionReturnsSchema = rpcTypeReferenceSchema.merge({
  /**
   * The relation whose rows the function returns, when that relation is in
   * the metadata; the row shape is the relation's `columns`.
   */
  relation_id: "number | null",
  /**
   * The columns of a `RETURNS TABLE (…)` or `OUT` parameter result, in name
   * order; `null` for every other return type.
   */
  columns: rpcTypeReferenceSchema.merge({ name: "string" }).array().or("null"),
});
export type RpcFunctionReturns = typeof rpcFunctionReturnsSchema.infer;

const rpcFunctionOverloadSchema = type({
  /** The `functions` entry this overload was resolved from. */
  function_id: "number",
  /** The input parameters (`in`, `inout` and `variadic`), in name order. */
  args: rpcFunctionArgSchema.array(),
  returns: rpcFunctionReturnsSchema,
  /** `true` when the response is an array of rows or values. */
  is_set_returning: "boolean",
  /** The planner's `ROWS` estimate of a set-returning function, else `null`. */
  rows_estimate: "number | null",
  /**
   * Present when the result can be embedded and sub-selected like a relation.
   * `to` names the relation (or composite type) whose rows come back, `from`
   * the relation a sole row-typed parameter embeds from, or `*` when the
   * function is called directly. `is_one_to_one` is `true` when at most one
   * row comes back, so a client may unwrap the array. `is_setof_return`
   * mirrors `is_set_returning`.
   */
  setof_options: type({
    from: "string",
    to: "string",
    is_one_to_one: "boolean",
    is_setof_return: "boolean",
  }).or("null"),
  /**
   * The relation this function is a computed field of: its sole input
   * parameter has that relation's row type, the relation is in the function's
   * schema, and no column of the relation shares the function's name. Such a
   * function is selectable as a nullable column of the relation.
   */
  computed_field_of: "number | null",
  /**
   * Why PostgREST cannot resolve a call to this overload, when it cannot: the
   * function conflicts with another overload, or its sole parameter is an
   * unnamed row, which PostgREST never matches under `/rpc` (the function is
   * a computed field or computed relationship, reached by embedding).
   * Generators surface the message instead of a callable signature.
   */
  error: "string | null",
});
export type RpcFunctionOverload = typeof rpcFunctionOverloadSchema.infer;

/**
 * A function PostgREST exposes under `/rpc`, with its overloads resolved.
 * Produced by `resolveRpcFunctions` from the raw `functions` collection.
 */
const rpcFunctionSchema = type({
  schema: "string",
  name: "string",
  /** Ordered by argument list, then by return type. Never empty. */
  overloads: rpcFunctionOverloadSchema.array(),
});
export type RpcFunction = typeof rpcFunctionSchema.infer;

/**
 * Bumped whenever `GeneratorMetadata`'s shape changes in a way a consumer
 * should branch on. Out-of-process consumers (a generator in another
 * language's SDK repo, fed JSON over a process boundary) only see the
 * serialized document, so a shape change is otherwise undetectable until
 * something breaks at read time.
 */
export const GENERATOR_METADATA_VERSION = 1;

/**
 * The complete set of introspected metadata required to generate types.
 * Produced by `introspect()` (the default SQL-based producer) or any other
 * source able to satisfy this shape. The table-like collections drop the
 * optional `columns` field (mirroring `Omit<…, "columns">`); columns are
 * carried separately on `columns`.
 */
export const generatorMetadataSchema = type({
  version: `${GENERATOR_METADATA_VERSION}`,
  schemas: postgresSchemaSchema.array(),
  tables: postgresTableSchema.omit("columns").array(),
  foreignTables: postgresForeignTableSchema.omit("columns").array(),
  views: postgresViewSchema.omit("columns").array(),
  materializedViews: postgresMaterializedViewSchema.omit("columns").array(),
  columns: postgresColumnSchema.array(),
  primaryKeys: postgresPrimaryKeySchema.array(),
  relationships: postgresRelationshipSchema.array(),
  functions: postgresFunctionSchema.array(),
  types: postgresTypeSchema.array(),
  /**
   * The PostgREST view of `functions`: which are callable through `/rpc`, how
   * their overloads group and what a call returns. Derived from the other
   * collections by `resolveRpcFunctions`, which `introspect()` runs. Optional
   * because version 1 documents predating the collection are still valid;
   * a generator falls back to running `resolveRpcFunctions` itself.
   */
  "rpcFunctions?": rpcFunctionSchema.array(),
});
export type GeneratorMetadata = typeof generatorMetadataSchema.infer;

/**
 * JSON Schema for {@link generatorMetadataSchema}, published so out-of-process
 * consumers (a generator living in its own SDK repo, not this package) can
 * validate or generate types against the contract without depending on
 * ArkType or this package's TypeScript types.
 */
export const generatorMetadataJsonSchema =
  generatorMetadataSchema.toJsonSchema();

/**
 * Serialize a {@link GeneratorMetadata} value to the JSON document that
 * crosses the process boundary to an out-of-process generator (e.g. `dart
 * run supabase_typegen`). `GeneratorMetadata` is plain, JSON-safe data, so
 * this is a thin, explicit boundary rather than a transform, kept as a named
 * export so every caller serializes the contract the same way.
 */
export function serializeGeneratorMetadata(
  metadata: GeneratorMetadata,
): string {
  return JSON.stringify(metadata);
}

/**
 * Validate an unknown value against the {@link generatorMetadataSchema} and
 * return it typed as {@link GeneratorMetadata}. Throws a `TypeError` with
 * ArkType's human-readable summary if validation fails.
 *
 * Offered as an opt-in helper so any integrator producing `GeneratorMetadata`
 * through an injected adapter can verify the result at runtime instead of
 * casting. `introspect()` does not call this — wrap its result yourself when
 * you want the guarantee:
 *
 * ```ts
 * const metadata = parseGeneratorMetadata(await introspect(db));
 * ```
 */
export function parseGeneratorMetadata(data: unknown): GeneratorMetadata {
  const out = generatorMetadataSchema(data);
  if (out instanceof type.errors) {
    throw new TypeError(`Invalid GeneratorMetadata: ${out.summary}`);
  }
  return out;
}
