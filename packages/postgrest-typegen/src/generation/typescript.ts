// oxlint-disable typescript/restrict-template-expressions -- this is a verbatim port of
// postgres-meta's template, which intentionally interpolates arrays/values into template
// literals (relying on Array#toString) to build the output. Preserving that is required for
// byte-parity, and the offending expressions sit inside template literals where a targeted
// disable comment would corrupt the emitted string.
import type {
  GeneratorMetadata,
  PostgresColumn,
  PostgresForeignTable,
  PostgresMaterializedView,
  PostgresSchema,
  PostgresTable,
  PostgresType,
  PostgresView,
  RpcFunction,
  RpcFunctionOverload,
  RpcTypeReference,
} from "../types.ts";
import { compareStrings } from "../collation.ts";
import { resolveRpcFunctions } from "../rpc.ts";

export interface GenerateTypescriptOptions {
  /**
   * Emit `isOneToOne` on each relationship entry. Mirrors postgres-meta's
   * `detect_one_to_one_relationships` query flag. Default `false`.
   */
  detectOneToOneRelationships?: boolean;
  /**
   * When set, emit `__InternalSupabase.PostgrestVersion` so `createClient`
   * can be instantiated with the right options automatically.
   */
  postgrestVersion?: string;
  /**
   * Schema treated as the default for the generated `Tables`/`Enums`/etc.
   * helper types. Replaces postgres-meta's `GENERATE_TYPES_DEFAULT_SCHEMA`
   * env read. Default `'public'`. When it is not among the generated schemas,
   * the first generated schema is used instead, so the helpers keep resolving.
   */
  defaultSchema?: string;
  /**
   * Formatter used on the generated output. Defaults to `oxfmt`, an optional
   * peer dependency that is imported only when this default runs, so callers
   * that always pass their own formatter need not install it. Callers on a
   * latency-sensitive request path (e.g. postgres-meta's hosted
   * `/generators/typescript` route) can substitute a worker-pool-backed
   * formatter here instead of blocking the event loop on every call.
   */
  format?: (code: string) => Promise<string>;
}

const loadOxfmt = async () => {
  try {
    return await import("oxfmt");
  } catch (error) {
    throw new Error(
      "oxfmt is not installed. It is an optional peer dependency that only the default formatter needs: install it, or pass a `format` option to generateTypescript.",
      { cause: error },
    );
  }
};

const defaultFormat = async (code: string): Promise<string> => {
  const { format } = await loadOxfmt();
  const { code: formatted, errors } = await format("output.ts", code, {
    semi: false,
    printWidth: 80,
  });
  if (errors.length > 0) {
    throw new Error(
      `oxfmt failed to format generated TypeScript output: ${errors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }
  return formatted;
};

/**
 * Collections `pgTypeToTsType` resolves a relation-typed value against.
 *
 * Foreign tables are generated under `Tables` and materialized views under
 * `Views`, exactly like their plain counterparts, so a value typed as one has
 * a `Row` to point at and belongs here. Both are optional so the exported
 * `pgTypeToTsType` signature stays backwards compatible.
 */
export type TypeResolutionContext = {
  types: PostgresType[];
  schemas: PostgresSchema[];
  tables: PostgresTable[];
  views: PostgresView[];
  foreignTables?: PostgresForeignTable[];
  materializedViews?: PostgresMaterializedView[];
};

type TsRelationship = Pick<
  GeneratorMetadata["relationships"][number],
  | "foreign_key_name"
  | "columns"
  | "is_one_to_one"
  | "referenced_relation"
  | "referenced_columns"
>;

/**
 * Does not re-sort collections; pass input pre-sorted with
 * `sortGeneratorMetadata` first. Still merge-sorts tables+foreign tables and
 * views+materialized views per schema, since that cross-collection grouping
 * can't be expressed by the single-collection `sortGeneratorMetadata` pass.
 */
export const generateTypescript = async (
  metadata: GeneratorMetadata,
  opts: GenerateTypescriptOptions = {},
): Promise<string> => {
  const {
    schemas,
    tables,
    foreignTables,
    views,
    materializedViews,
    columns,
    relationships,
    types,
  } = metadata;
  // Documents predating the collection (still valid version 1) resolve it here.
  const rpcFunctions = metadata.rpcFunctions ?? resolveRpcFunctions(metadata);
  const {
    detectOneToOneRelationships = false,
    postgrestVersion,
    defaultSchema = "public",
    format = defaultFormat,
  } = opts;
  const resolvedDefaultSchema =
    schemas.some(({ name }) => name === defaultSchema) || !schemas[0]
      ? defaultSchema
      : schemas[0].name;
  // Every relation-typed value resolves against the same collections, so build
  // the lookup context once rather than reassembling it at each call site.
  const typeContext: TypeResolutionContext = {
    types,
    schemas,
    tables,
    views,
    foreignTables,
    materializedViews,
  };
  // Ordering of all collections (incl. relationships, columns, args below) is
  // provided by `sortGeneratorMetadata`; this generator no longer re-sorts.
  const introspectionBySchema = Object.fromEntries<{
    tables: {
      table: Pick<PostgresTable, "id" | "name" | "schema" | "columns">;
      relationships: TsRelationship[];
    }[];
    views: {
      view: PostgresView;
      relationships: TsRelationship[];
    }[];
    functions: RpcFunction[];
    enums: PostgresType[];
    compositeTypes: PostgresType[];
  }>(
    schemas.map((s) => [
      s.name,
      { tables: [], views: [], functions: [], enums: [], compositeTypes: [] },
    ]),
  );
  const columnsByTableId: Record<number, PostgresColumn[]> = {};
  const relationsById = new Map<number, { id: number; schema: string }>();
  // group types by id for quicker lookup
  const typesById = new Map<number, (typeof types)[number]>();
  const tablesLike = [
    ...tables,
    ...foreignTables,
    ...views,
    ...materializedViews,
  ];

  for (const tableLike of tablesLike) {
    columnsByTableId[tableLike.id] = [];
    relationsById.set(tableLike.id, tableLike);
  }
  for (const column of columns) {
    columnsByTableId[column.table_id]?.push(column);
  }
  const getColumns = (tableId: number): PostgresColumn[] => {
    const tableColumns = columnsByTableId[tableId];
    if (!tableColumns) {
      throw new Error(
        `Relation ${tableId} is missing from the generator metadata`,
      );
    }
    return tableColumns;
  };
  const getSchemaIntrospection = (schemaName: string) => {
    const schemaIntrospection = introspectionBySchema[schemaName];
    if (!schemaIntrospection) {
      throw new Error(
        `Schema ${JSON.stringify(schemaName)} is missing from the generator metadata`,
      );
    }
    return schemaIntrospection;
  };

  for (const type of types) {
    typesById.set(type.id, type);
    if (type.enums.length > 0) {
      introspectionBySchema[type.schema]?.enums.push(type);
    }
    if (type.attributes.length > 0) {
      introspectionBySchema[type.schema]?.compositeTypes.push(type);
    }
  }

  const relationshipsByRelation = new Map<
    string,
    GeneratorMetadata["relationships"]
  >();
  for (const relationship of relationships) {
    const key = `${relationship.schema}.${relationship.relation}`;
    let bucket = relationshipsByRelation.get(key);
    if (!bucket) {
      bucket = [];
      relationshipsByRelation.set(key, bucket);
    }
    bucket.push(relationship);
  }

  function getRelationships(object: {
    schema: string;
    name: string;
  }): Pick<
    GeneratorMetadata["relationships"][number],
    | "foreign_key_name"
    | "columns"
    | "is_one_to_one"
    | "referenced_relation"
    | "referenced_columns"
  >[] {
    const candidates = relationshipsByRelation.get(
      `${object.schema}.${object.name}`,
    );
    if (!candidates) return [];
    return candidates.filter(
      (relationship) => relationship.referenced_schema === object.schema,
    );
  }

  function generateRelationshiptTsDefinition(
    relationship: TsRelationship,
  ): string {
    return `{
      foreignKeyName: ${JSON.stringify(relationship.foreign_key_name)}
      columns: ${JSON.stringify(relationship.columns)}${
        detectOneToOneRelationships
          ? `\nisOneToOne: ${relationship.is_one_to_one}`
          : ""
      }
      referencedRelation: ${JSON.stringify(relationship.referenced_relation)}
      referencedColumns: ${JSON.stringify(relationship.referenced_columns)}
    }`;
  }

  for (const table of tables) {
    introspectionBySchema[table.schema]?.tables.push({
      table,
      relationships: getRelationships(table),
    });
  }
  for (const table of foreignTables) {
    introspectionBySchema[table.schema]?.tables.push({
      table,
      relationships: getRelationships(table),
    });
  }
  for (const view of views) {
    introspectionBySchema[view.schema]?.views.push({
      view,
      relationships: getRelationships(view),
    });
  }
  for (const materializedView of materializedViews) {
    introspectionBySchema[materializedView.schema]?.views.push({
      view: {
        ...materializedView,
        is_updatable: false,
        is_insert_enabled: false,
        is_update_enabled: false,
      },
      relationships: getRelationships(materializedView),
    });
  }
  for (const fn of rpcFunctions) {
    introspectionBySchema[fn.schema]?.functions.push(fn);
  }
  // These per-schema groups MERGE multiple metadata collections — `.tables`
  // combines tables + foreign tables, `.views` combines views + materialized
  // views — so the cross-collection name sort can't be expressed by the
  // single-collection `sortGeneratorMetadata` pass and stays here.
  for (const schemaIntrospection of Object.values(introspectionBySchema)) {
    schemaIntrospection.tables.sort((a, b) =>
      compareStrings(a.table.name, b.table.name),
    );
    schemaIntrospection.views.sort((a, b) =>
      compareStrings(a.view.name, b.view.name),
    );
    schemaIntrospection.enums.sort((a, b) => compareStrings(a.name, b.name));
    schemaIntrospection.compositeTypes.sort((a, b) =>
      compareStrings(a.name, b.name),
    );
  }

  const referencedTsType = (
    schema: PostgresSchema,
    { format, type_schema }: RpcTypeReference,
  ) =>
    format === null || type_schema === null
      ? "unknown"
      : pgTypeToTsType(schema, format, typeContext, type_schema);

  const getFunctionTsReturnType = (
    overload: RpcFunctionOverload,
    returnType: string,
  ) => {
    const { setof_options } = overload;
    const setofOptionsInfo = setof_options
      ? `SetofOptions: {
        from: ${JSON.stringify(setof_options.from)}
        to: ${JSON.stringify(setof_options.to)}
        isOneToOne: ${setof_options.is_one_to_one}
        isSetofReturn: ${setof_options.is_setof_return}
      }`
      : "";
    // A ROWS 1 estimate may only collapse the array type when SetofOptions is also emitted:
    // postgrest-js relies on isOneToOne to restore the array shape for direct RPC calls.
    // Without that metadata PostgREST still returns an array, so the collapse would make
    // the type diverge from the actual response.
    const collapsibleSingleRow = setof_options?.is_one_to_one === true;
    const isArray =
      overload.error === null &&
      overload.is_set_returning &&
      !collapsibleSingleRow;
    return `${returnType}${isArray ? "[]" : ""}
                          ${setofOptionsInfo}`;
  };

  const getFunctionReturnType = (
    schema: PostgresSchema,
    { returns }: RpcFunctionOverload,
  ): string => {
    // Case 1: `returns table`.
    if (returns.columns) {
      return `{
              ${returns.columns.map(
                (column) =>
                  `${JSON.stringify(column.name)}: ${referencedTsType(schema, column)}`,
              )}
            }`;
    }

    // Case 2: returns a row type of a relation in this schema.
    const relation =
      returns.relation_id === null
        ? undefined
        : relationsById.get(returns.relation_id);
    if (relation && relation.schema === schema.name) {
      return `{
              ${getColumns(relation.id)
                .map((column) =>
                  generateColumnTsDefinition(
                    schema,
                    {
                      name: column.name,
                      format: column.format,
                      type_schema: column.type_schema,
                      is_nullable: column.is_nullable,
                      is_optional: false,
                    },
                    typeContext,
                  ),
                )
                .join(",\n")}
            }`;
    }

    // Case 3: returns base/array/composite/enum type.
    return referencedTsType(schema, returns);
  };

  const getArgTsType = (
    schema: PostgresSchema,
    arg: RpcFunctionOverload["args"][number],
  ) => {
    const tsType = referencedTsType(schema, arg);
    // A row-typed parameter takes the relation's columns: PostgREST fills the
    // keys it does not receive with NULL, and the computed fields are never
    // input. A named parameter is typed without them. An unnamed one keeps the
    // plain `Row` reference, which is how postgrest-js versions predating
    // `ComputedFields` recognise the function as a computed field.
    if (arg.name === "" || arg.format === null || arg.type_schema === null) {
      return tsType;
    }
    const relationReference = findRelationReference(
      arg.format,
      typeContext,
      arg.type_schema,
    );
    if (relationReference && tsType === `${relationReference}['Row']`) {
      return `Omit<${tsType}, ${relationReference}['ComputedFields']>`;
    }
    return tsType;
  };

  const getArgsTsType = (
    schema: PostgresSchema,
    args: RpcFunctionOverload["args"],
  ) =>
    `{ ${args.map(
      (arg) =>
        `${JSON.stringify(arg.name)}${arg.has_default ? "?" : ""}: ${getArgTsType(schema, arg)}`,
    )} }`;

  const getFunctionSignatures = (schema: PostgresSchema, fn: RpcFunction) => {
    return fn.overloads
      .map((overload) => {
        // `never` would be wrong here: postgrest-js treats `Args extends { '': Row }`
        // as a computed field (`never extends T` is always true, so same-named table
        // columns get omitted from select results), and an object type with a required
        // `never` property is uninhabited for any tool doing sound type math on the
        // generated types. `Record<PropertyKey, never>` is the accurate type for
        // "callable with no arguments".
        const argsType =
          overload.args.length > 0
            ? getArgsTsType(schema, overload.args)
            : "Record<PropertyKey, never>";
        const returnType =
          overload.error === null
            ? getFunctionReturnType(schema, overload)
            : `{ error: true } & ${JSON.stringify(overload.error)}`;

        return `{ Args: ${argsType}; Returns: ${getFunctionTsReturnType(overload, returnType)} }`;
      })
      .join(" |\n");
  };

  const internal_supabase_schema = postgrestVersion
    ? `// Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '${postgrestVersion}'
  }`
    : "";

  function generateNullableUnionTsType(tsType: string, isNullable: boolean) {
    // The generated Json type includes null, so a NOT NULL json/jsonb column
    // has to be narrowed with NonNullable to reflect the database constraint.
    if (tsType === "Json" && !isNullable) {
      return `NonNullable<${tsType}>`;
    }
    // Only add the null union if the type is not unknown as unknown already includes null
    if (tsType === "unknown" || tsType === "any" || !isNullable) {
      return tsType;
    }
    return `${tsType} | null`;
  }

  function generateColumnTsDefinition(
    schema: PostgresSchema,
    column: {
      name: string;
      format: string;
      type_schema: string;
      is_nullable: boolean;
      is_optional: boolean;
    },
    context: TypeResolutionContext,
  ) {
    return `${JSON.stringify(column.name)}${column.is_optional ? "?" : ""}: ${generateNullableUnionTsType(
      pgTypeToTsType(schema, column.format, context, column.type_schema),
      column.is_nullable,
    )}`;
  }

  /**
   * The computed fields of a relation, in function name order. A computed
   * field is a function taking a single argument of the relation's own
   * composite type, so it is selectable as if it were a column and belongs in
   * `Row`; `resolveRpcFunctions` marks them with `computed_field_of`.
   */
  const computedFieldsOf = (
    schemaFunctions: RpcFunction[],
    relation: { id: number },
  ) =>
    schemaFunctions.flatMap((fn) => {
      const overload = fn.overloads.find(
        ({ computed_field_of }) => computed_field_of === relation.id,
      );
      return overload ? [{ name: fn.name, overload }] : [];
    });

  const computedFieldTsDefinition = (
    schema: PostgresSchema,
    { name, overload }: { name: string; overload: RpcFunctionOverload },
  ) =>
    `${JSON.stringify(name)}: ${generateNullableUnionTsType(
      getFunctionReturnType(schema, overload),
      true,
    )}`;

  // `ComputedFields` names the `Row` keys PostgREST leaves out of `select('*')`,
  // so postgrest-js does not have to infer them from `Functions`.
  const computedFieldsTsType = (computedFields: { name: string }[]) =>
    computedFields.length === 0
      ? "never"
      : computedFields.map(({ name }) => JSON.stringify(name)).join(" | ");

  let output = `
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  ${internal_supabase_schema}
  ${schemas.map((schema) => {
    const {
      tables: schemaTables,
      views: schemaViews,
      functions: schemaFunctions,
      enums: schemaEnums,
      compositeTypes: schemaCompositeTypes,
    } = getSchemaIntrospection(schema.name);
    return `${JSON.stringify(schema.name)}: {
          Tables: {
            ${
              schemaTables.length === 0
                ? "[_ in never]: never"
                : schemaTables.map(({ table, relationships }) => {
                    const computedFields = computedFieldsOf(
                      schemaFunctions,
                      table,
                    );
                    return `${JSON.stringify(table.name)}: {
                  Row: {
                    ${[
                      ...getColumns(table.id).map((column) =>
                        generateColumnTsDefinition(
                          schema,
                          {
                            name: column.name,
                            format: column.format,
                            type_schema: column.type_schema,
                            is_nullable: column.is_nullable,
                            is_optional: false,
                          },
                          typeContext,
                        ),
                      ),
                      ...computedFields.map((computedField) =>
                        computedFieldTsDefinition(schema, computedField),
                      ),
                    ]}
                  }
                  ComputedFields: ${computedFieldsTsType(computedFields)}
                  Insert: {
                    ${getColumns(table.id).map((column) => {
                      if (
                        column.identity_generation === "ALWAYS" ||
                        column.is_generated
                      ) {
                        return `${JSON.stringify(column.name)}?: never`;
                      }
                      return generateColumnTsDefinition(
                        schema,
                        {
                          name: column.name,
                          format: column.format,
                          type_schema: column.type_schema,
                          is_nullable: column.is_nullable,
                          is_optional:
                            column.is_nullable ||
                            column.is_identity ||
                            column.default_value !== null,
                        },
                        typeContext,
                      );
                    })}
                  }
                  Update: {
                    ${getColumns(table.id).map((column) => {
                      if (
                        column.identity_generation === "ALWAYS" ||
                        column.is_generated
                      ) {
                        return `${JSON.stringify(column.name)}?: never`;
                      }

                      return generateColumnTsDefinition(
                        schema,
                        {
                          name: column.name,
                          format: column.format,
                          type_schema: column.type_schema,
                          is_nullable: column.is_nullable,
                          is_optional: true,
                        },
                        typeContext,
                      );
                    })}
                  }
                  Relationships: [
                    ${relationships.map(generateRelationshiptTsDefinition)}
                  ]
                }`;
                  })
            }
          }
          Views: {
            ${
              schemaViews.length === 0
                ? "[_ in never]: never"
                : schemaViews.map(({ view, relationships }) => {
                    const computedFields = computedFieldsOf(
                      schemaFunctions,
                      view,
                    );
                    return `${JSON.stringify(view.name)}: {
                  Row: {
                    ${[
                      ...getColumns(view.id).map((column) =>
                        generateColumnTsDefinition(
                          schema,
                          {
                            name: column.name,
                            format: column.format,
                            type_schema: column.type_schema,
                            is_nullable: column.is_nullable,
                            is_optional: false,
                          },
                          typeContext,
                        ),
                      ),
                      ...computedFields.map((computedField) =>
                        computedFieldTsDefinition(schema, computedField),
                      ),
                    ]}
                  }
                  ComputedFields: ${computedFieldsTsType(computedFields)}
                  ${
                    // Metadata predating the trigger-aware flags (still valid
                    // version 1 documents) falls back to the old gate.
                    (view.is_insert_enabled ?? view.is_updatable)
                      ? `Insert: {
                           ${getColumns(view.id).map((column) => {
                             if (!column.is_updatable) {
                               return `${JSON.stringify(column.name)}?: never`;
                             }
                             return generateColumnTsDefinition(
                               schema,
                               {
                                 name: column.name,
                                 format: column.format,
                                 type_schema: column.type_schema,
                                 is_nullable: true,
                                 is_optional: true,
                               },
                               typeContext,
                             );
                           })}
                         }
                        `
                      : ""
                  }${
                    (view.is_update_enabled ?? view.is_updatable)
                      ? `Update: {
                           ${getColumns(view.id).map((column) => {
                             if (!column.is_updatable) {
                               return `${JSON.stringify(column.name)}?: never`;
                             }
                             return generateColumnTsDefinition(
                               schema,
                               {
                                 name: column.name,
                                 format: column.format,
                                 type_schema: column.type_schema,
                                 is_nullable: true,
                                 is_optional: true,
                               },
                               typeContext,
                             );
                           })}
                         }
                        `
                      : ""
                  }Relationships: [
                    ${relationships.map(generateRelationshiptTsDefinition)}
                  ]
                }`;
                  })
            }
          }
          Functions: {
            ${
              schemaFunctions.length === 0
                ? "[_ in never]: never"
                : schemaFunctions
                    .map(
                      (fn) =>
                        `${JSON.stringify(fn.name)}:\n${getFunctionSignatures(schema, fn)}`,
                    )
                    .join(",\n")
            }
          }
          Enums: {
            ${
              schemaEnums.length === 0
                ? "[_ in never]: never"
                : schemaEnums.map(
                    (enum_) =>
                      `${JSON.stringify(enum_.name)}: ${enum_.enums
                        .map((variant) => JSON.stringify(variant))
                        .join("|")}`,
                  )
            }
          }
          CompositeTypes: {
            ${
              schemaCompositeTypes.length === 0
                ? "[_ in never]: never"
                : schemaCompositeTypes.map(
                    ({ name, attributes }) =>
                      `${JSON.stringify(name)}: {
                        ${attributes.map(({ name, type_id }) => {
                          const type = typesById.get(type_id);
                          let tsType = "unknown";
                          if (type) {
                            tsType = `${generateNullableUnionTsType(
                              pgTypeToTsType(
                                schema,
                                type.name,
                                typeContext,
                                type.schema,
                              ),
                              true,
                            )}`;
                          }
                          return `${JSON.stringify(name)}: ${tsType}`;
                        })}
                      }`,
                  )
            }
          }
        }`;
  })}
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, ${JSON.stringify(
    resolvedDefaultSchema,
  )}>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  ${schemas.map((schema) => {
    const schemaEnums = getSchemaIntrospection(schema.name).enums;
    return `${JSON.stringify(schema.name)}: {
          Enums: {
            ${schemaEnums.map(
              (enum_) =>
                `${JSON.stringify(enum_.name)}: [${enum_.enums
                  .map((variant) => JSON.stringify(variant))
                  .join(", ")}]`,
            )}
          }
        }`;
  })}
} as const
`;

  output = await format(output);
  return output;
};

// TODO: Make this more robust. Currently doesn't handle range types - returns them as unknown.
export const pgTypeToTsType = (
  schema: PostgresSchema,
  pgType: string,
  context: TypeResolutionContext,
  // The schema that actually owns `pgType`, from the column's `type_schema` or
  // the resolved `PostgresType.schema`. Disambiguates same-named enums,
  // composites and relations across schemas. Falls back to `schema.name` (the
  // schema being generated) when not provided, which is only a guess, so pass
  // it whenever the owning schema is known.
  typeSchema?: string,
): string => {
  const { types, schemas } = context;
  if (pgType === "bool") {
    return "boolean";
  } else if (
    ["int2", "int4", "int8", "float4", "float8", "numeric"].includes(pgType)
  ) {
    return "number";
  } else if (
    [
      "bytea",
      "bpchar",
      "varchar",
      "date",
      "text",
      "citext",
      "time",
      "timetz",
      "timestamp",
      "timestamptz",
      "uuid",
      "vector",
      "interval",
    ].includes(pgType)
  ) {
    return "string";
  } else if (["json", "jsonb"].includes(pgType)) {
    return "Json";
  } else if (pgType === "void") {
    return "undefined";
  } else if (pgType === "record") {
    return "Record<string, unknown>";
  } else if (pgType.startsWith("_")) {
    return `(${pgTypeToTsType(schema, pgType.substring(1), context, typeSchema)})[]`;
  } else {
    const preferredSchema = typeSchema ?? schema.name;
    const enumTypes = types.filter(
      (type) => type.name === pgType && type.enums.length > 0,
    );
    const enumType =
      enumTypes.find((type) => type.schema === preferredSchema) ?? enumTypes[0];
    if (enumType) {
      if (schemas.some(({ name }) => name === enumType.schema)) {
        return `Database[${JSON.stringify(enumType.schema)}]['Enums'][${JSON.stringify(
          enumType.name,
        )}]`;
      }
      return enumType.enums.map((variant) => JSON.stringify(variant)).join("|");
    }

    const compositeTypes = types.filter(
      (type) => type.name === pgType && type.attributes.length > 0,
    );
    const compositeType =
      compositeTypes.find((type) => type.schema === preferredSchema) ??
      compositeTypes[0];
    if (compositeType) {
      if (schemas.some(({ name }) => name === compositeType.schema)) {
        return `Database[${JSON.stringify(
          compositeType.schema,
        )}]['CompositeTypes'][${JSON.stringify(compositeType.name)}]`;
      }
      return "unknown";
    }

    const relationReference = findRelationReference(
      pgType,
      context,
      preferredSchema,
    );
    return relationReference ? `${relationReference}['Row']` : "unknown";
  }
};

/**
 * The `Database[schema][kind][name]` reference of the relation whose row type
 * is `pgType`, or `undefined` when no generated relation has that type.
 *
 * A relation-typed value carries only a bare type name, so several relations
 * can share it and `preferredSchema` is what disambiguates them. Match on the
 * schema across every relation kind before falling back to kind order,
 * otherwise a relation in an unrelated schema outranks the one the caller
 * meant. Foreign tables are generated under `Tables` and materialized views
 * under `Views`, alongside their plain counterparts.
 */
const findRelationReference = (
  pgType: string,
  context: TypeResolutionContext,
  preferredSchema: string,
): string | undefined => {
  const {
    schemas,
    tables,
    views,
    foreignTables = [],
    materializedViews = [],
  } = context;
  const relationKinds = [
    ["Tables", tables],
    ["Tables", foreignTables],
    ["Views", views],
    ["Views", materializedViews],
  ] as const;
  const findRelation = (
    matches: (relation: { name: string; schema: string }) => boolean,
  ) => {
    for (const [kind, relations] of relationKinds) {
      const relation = relations.find(matches);
      if (relation) return { kind, relation };
    }
    return undefined;
  };
  const match =
    findRelation(
      ({ name, schema: relationSchema }) =>
        name === pgType && relationSchema === preferredSchema,
    ) ?? findRelation(({ name }) => name === pgType);
  if (!match || !schemas.some(({ name }) => name === match.relation.schema)) {
    return undefined;
  }
  const { kind, relation } = match;
  return `Database[${JSON.stringify(relation.schema)}]['${kind}'][${JSON.stringify(
    relation.name,
  )}]`;
};
