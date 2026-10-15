/**
 * Resolves the PostgREST view of `GeneratorMetadata.functions`.
 *
 * The raw `functions` collection is `pg_proc` as introspected. Which of those
 * functions PostgREST exposes under `/rpc`, how their overloads group, what a
 * call returns and whether a function doubles as a computed field or an
 * embeddable relation are PostgREST rules, not language rules. This pass
 * applies them once so every generator, in this package or in another SDK
 * repo reading the serialized document, emits the same RPC surface.
 *
 * Pure and deterministic: the output is canonically ordered regardless of the
 * order of the input collections. `introspect()` attaches the result as
 * `rpcFunctions`; generators that meet a document without it (produced by a
 * version predating the collection, or by a custom producer) run this pass
 * themselves.
 */
import { compareStrings } from "./collation.ts";
import type {
  GeneratorMetadata,
  PostgresFunction,
  PostgresType,
  RpcFunction,
  RpcFunctionArg,
  RpcFunctionOverload,
  RpcTypeReference,
} from "./types.ts";

/** json, jsonb and text: the types PostgREST accepts for a single unnamed parameter. */
const UNNAMED_ARG_TYPE_IDS = new Set([114, 3802, 25]);
const INPUT_ARG_MODES = new Set(["in", "inout", "variadic"]);

type InputArg = PostgresFunction["args"][number] & {
  mode: RpcFunctionArg["mode"];
};

type Candidate = { fn: PostgresFunction; inArgs: InputArg[] };

export function resolveRpcFunctions(
  metadata: GeneratorMetadata,
): RpcFunction[] {
  const schemaNames = new Set(metadata.schemas.map(({ name }) => name));
  const typesById = new Map(metadata.types.map((type) => [type.id, type]));
  const relationTypesById = new Map(
    metadata.types
      .filter(
        (type): type is PostgresType & { type_relation_id: number } =>
          type.type_relation_id !== null,
      )
      .map((type) => [type.id, type]),
  );
  const relationsById = new Map(
    [
      ...metadata.tables,
      ...metadata.foreignTables,
      ...metadata.views,
      ...metadata.materializedViews,
    ].map((relation) => [relation.id, relation]),
  );
  const columnNamesByRelationId = new Map<number, Set<string>>();
  for (const column of metadata.columns) {
    let names = columnNamesByRelationId.get(column.table_id);
    if (!names) {
      names = new Set();
      columnNamesByRelationId.set(column.table_id, names);
    }
    names.add(column.name);
  }

  const typeReference = (typeId: number): RpcTypeReference => {
    const type = typesById.get(typeId);
    return {
      type_id: typeId,
      format: type?.name ?? null,
      type_schema: type?.schema ?? null,
    };
  };
  const typeName = (typeId: number) => typesById.get(typeId)?.name ?? "unknown";

  // The relation a return type stands for, or a composite type's name when the
  // return type is one, since both are relations in `pg_class`. Resolved
  // against every schema: a function may return rows of another schema.
  const returnRelationName = (fn: PostgresFunction): string | null => {
    if (fn.return_type_relation_id === null) return null;
    return (
      relationsById.get(fn.return_type_relation_id)?.name ??
      relationTypesById.get(fn.return_type_id)?.name ??
      null
    );
  };

  // The function is a computed field of the relation whose row type its sole
  // input parameter has, provided the relation lives in the function's schema
  // and has no column of the function's name: PostgREST resolves the name to
  // the column, so such a function is neither selectable nor part of `Row`.
  // When the parameter's type is not in `types` (a reduced custom document),
  // the rendered argument list may still name the relation.
  const computedFieldOf = ({ fn, inArgs }: Candidate): number | null => {
    const soleInArg = inArgs.length === 1 ? inArgs[0] : undefined;
    const argType = soleInArg && relationTypesById.get(soleInArg.type_id);
    const relation = argType
      ? relationsById.get(argType.type_relation_id)
      : [...relationsById.values()].find(
          (relation) =>
            relation.schema === fn.schema &&
            relation.name === fn.argument_types,
        );
    if (!relation || relation.schema !== fn.schema) return null;
    if (columnNamesByRelationId.get(relation.id)?.has(fn.name)) return null;
    return relation.id;
  };

  const isCallable = ({ inArgs }: Candidate): boolean => {
    if (inArgs.length === 0) return true;
    if (!inArgs.some(({ name }) => name === "")) return true;
    if (
      inArgs.every(
        (arg) =>
          arg.name !== "" ||
          (arg.has_default === true && UNNAMED_ARG_TYPE_IDS.has(arg.type_id)),
      )
    ) {
      return true;
    }
    const soleInArg = inArgs.length === 1 ? inArgs[0] : undefined;
    return (
      soleInArg !== undefined &&
      soleInArg.name === "" &&
      (UNNAMED_ARG_TYPE_IDS.has(soleInArg.type_id) ||
        relationTypesById.has(soleInArg.type_id))
    );
  };

  const overloadError = (
    candidate: Candidate,
    group: Candidate[],
  ): string | null => {
    const { fn, inArgs } = candidate;
    const soleInArg = inArgs.length === 1 ? inArgs[0] : undefined;
    if (group.length > 1) {
      // A no-argument overload next to one whose sole unnamed parameter has a
      // default: PostgREST cannot pick one for an empty call.
      if (inArgs.length === 0) {
        const conflicting = group.find(
          (other) =>
            other !== candidate &&
            other.inArgs.length === 1 &&
            other.inArgs[0]?.name === "" &&
            other.inArgs[0].has_default === true,
        );
        if (conflicting) {
          return `Could not choose the best candidate function between: ${fn.schema}.${fn.name}(), ${fn.schema}.${fn.name}( => ${typeName(conflicting.fn.return_type_id)}). Try renaming the parameters or the function itself in the database so function overloading can be resolved`;
        }
      }
      // Overloads whose sole parameter shares a name but not a type: a call
      // carries no type information, so PostgREST cannot pick one.
      if (soleInArg && soleInArg.name !== "") {
        const conflicting = group.filter(
          (other) =>
            other !== candidate &&
            other.inArgs.length === 1 &&
            other.inArgs[0]?.name === soleInArg.name &&
            other.inArgs[0].type_id !== soleInArg.type_id,
        );
        if (conflicting.length > 0) {
          const conflictList = [candidate, ...conflicting]
            .sort(
              (a, b) =>
                (a.inArgs[0]?.type_id || 0) - (b.inArgs[0]?.type_id || 0),
            )
            .map(
              (other) =>
                `${fn.schema}.${fn.name}(${other.inArgs
                  .map((arg) => `${arg.name} => ${typeName(arg.type_id)}`)
                  .join(", ")})`,
            )
            .join(", ");
          return `Could not choose the best candidate function between: ${conflictList}. Try renaming the parameters or the function itself in the database so function overloading can be resolved`;
        }
      }
    }
    // PostgREST passes a sole unnamed parameter only when it is json, jsonb or
    // text, so a function taking a row this way is a computed field or a
    // computed relationship, reachable by embedding it from its relation and
    // never through `/rpc`, whatever it returns.
    if (
      soleInArg &&
      soleInArg.name === "" &&
      relationTypesById.has(soleInArg.type_id)
    ) {
      return `the function ${fn.schema}.${fn.name} with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache`;
    }
    return null;
  };

  const resolveOverload = (
    candidate: Candidate,
    group: Candidate[],
  ): RpcFunctionOverload => {
    const { fn, inArgs } = candidate;
    const args: RpcFunctionArg[] = inArgs
      .map((arg) => {
        const relationId = relationTypesById.get(arg.type_id)?.type_relation_id;
        return {
          name: arg.name,
          mode: arg.mode,
          ...typeReference(arg.type_id),
          has_default: arg.has_default === true,
          relation_id:
            relationId !== undefined &&
            relationId !== null &&
            relationsById.has(relationId)
              ? relationId
              : null,
        };
      })
      .sort((a, b) => compareStrings(a.name, b.name));

    const tableColumns = fn.args
      .filter(({ mode }) => mode === "table")
      .map(({ name, type_id }) => ({ name, ...typeReference(type_id) }))
      .sort((a, b) => compareStrings(a.name, b.name));

    const relationName = returnRelationName(fn);
    const returnsMultipleRows = fn.prorows !== null && fn.prorows > 1;
    // A function whose sole parameter (of any mode) is a row type is embedded
    // from that relation; any other row-returning function embeds from `*`.
    const soleArg = fn.args.length === 1 ? fn.args[0] : undefined;
    const sourceType = soleArg && relationTypesById.get(soleArg.type_id);
    const setofOptions =
      relationName === null
        ? null
        : {
            from: sourceType ? sourceType.format : "*",
            to: relationName,
            is_one_to_one:
              sourceType && !fn.is_set_returning_function
                ? true
                : !returnsMultipleRows,
            is_setof_return: fn.is_set_returning_function,
          };

    return {
      function_id: fn.id,
      args,
      returns: {
        ...typeReference(fn.return_type_id),
        relation_id:
          fn.return_type_relation_id !== null &&
          relationsById.has(fn.return_type_relation_id)
            ? fn.return_type_relation_id
            : null,
        columns: tableColumns.length > 0 ? tableColumns : null,
      },
      is_set_returning: fn.is_set_returning_function,
      rows_estimate: fn.prorows,
      setof_options: setofOptions,
      computed_field_of: computedFieldOf(candidate),
      error: overloadError(candidate, group),
    };
  };

  const groups = new Map<string, Candidate[]>();
  for (const fn of metadata.functions) {
    if (!schemaNames.has(fn.schema)) continue;
    const inArgs = fn.args.filter((arg): arg is InputArg =>
      INPUT_ARG_MODES.has(arg.mode),
    );
    const candidate = { fn, inArgs };
    if (!isCallable(candidate)) continue;
    const key = `${fn.schema}.${fn.name}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(candidate);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = [...group].sort(
        (a, b) =>
          compareStrings(a.fn.argument_types, b.fn.argument_types) ||
          compareStrings(a.fn.return_type, b.fn.return_type) ||
          a.fn.id - b.fn.id,
      );
      const [{ fn }] = sorted as [Candidate, ...Candidate[]];
      return {
        schema: fn.schema,
        name: fn.name,
        overloads: sorted.map((candidate) =>
          resolveOverload(candidate, sorted),
        ),
      };
    })
    .sort(
      (a, b) =>
        compareStrings(a.schema, b.schema) || compareStrings(a.name, b.name),
    );
}
