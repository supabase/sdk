import { GENERATOR_METADATA_VERSION, } from "@supabase/postgrest-typegen";
/** The generators key tables, columns and types by oid; a hash keeps ids stable across runs. */
const oid = (key) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++)
        hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193) >>> 0;
    return 16384 + (hash % 2_000_000_000);
};
/** `format_type` spells these out; `pg_type.typname`, which the generators match on, does not. */
const UDT = {
    bigint: "int8",
    integer: "int4",
    smallint: "int2",
    boolean: "bool",
    "double precision": "float8",
    real: "float4",
    "timestamp with time zone": "timestamptz",
    "timestamp without time zone": "timestamp",
    "time with time zone": "timetz",
    "time without time zone": "time",
    "character varying": "varchar",
    character: "bpchar",
    bit: "bit",
    "bit varying": "varbit",
};
/**
 * The metadata `introspect()` would read from `pg_catalog`, built from Spark's description so the
 * shared generators run unchanged. The description has no functions or composite types, so those
 * come out empty. Temporary: `introspect()` replaces this once Spark's engine exposes the catalogs
 * it reads.
 */
export const sparkGeneratorMetadata = (description, options) => {
    const included = (schema) => options.schemas.includes(schema);
    const relationId = (r) => oid(`${r.schema}.${r.name}`);
    const typeOf = (type) => {
        // Postgres names an array type `_<element>` whatever its dimensions.
        const element = type.replace(/(?:\s*\[\d*\])+$/u, "");
        const array = element !== type;
        const inner = element.replace(/\(.*?\)/u, "").trim();
        const found = description.enums.find((e) => inner === `${e.schema}.${e.name}` ||
            (e.schema === "public" && inner === e.name) ||
            inner === `"${e.schema}"."${e.name}"`);
        const udt = found === undefined ? (UDT[inner] ?? inner) : found.name;
        return {
            data_type: array ? "ARRAY" : found === undefined ? inner : "USER-DEFINED",
            format: array ? `_${udt}` : udt,
            type_schema: found === undefined ? "pg_catalog" : found.schema,
            enums: found === undefined ? [] : [...found.labels],
        };
    };
    const column = (t, c, updatable) => {
        const check = t.constraints.find((k) => k.type === "c" && k.columns.length === 1 && k.columns[0] === c.name);
        return {
            table_id: relationId(t),
            schema: t.schema,
            table: t.name,
            id: `${relationId(t)}.${c.position}`,
            ordinal_position: c.position,
            name: c.name,
            default_value: c.identity === null ? c.default : null,
            ...typeOf(c.type),
            is_identity: c.identity !== null,
            identity_generation: c.identity === "a"
                ? "ALWAYS"
                : c.identity === "d"
                    ? "BY DEFAULT"
                    : null,
            is_generated: c.generated !== null && c.generated !== "",
            is_nullable: !c.not_null,
            is_updatable: updatable,
            is_unique: t.constraints.some((k) => k.type === "u" && k.columns.length === 1 && k.columns[0] === c.name),
            // `pg_get_constraintdef` renders `CHECK (expr)`; the generators want `expr`.
            check: check === undefined ? null : check.def.slice(7, -1),
            comment: c.comment,
        };
    };
    const tables = description.tables.filter((t) => included(t.schema));
    const views = description.views.filter((v) => included(v.schema));
    const schemaNames = [
        ...new Set([
            ...description.schemas.map((s) => s.name),
            ...description.managed_schemas,
            "public",
        ]),
    ];
    return {
        version: GENERATOR_METADATA_VERSION,
        schemas: schemaNames.filter(included).map((name) => ({
            id: oid(`schema.${name}`),
            name,
            owner: description.managed_schemas.includes(name)
                ? "supabase_admin"
                : "postgres",
        })),
        tables: tables.map((t) => ({
            id: relationId(t),
            schema: t.schema,
            name: t.name,
            rls_enabled: t.rls_enabled,
            rls_forced: t.rls_forced,
            replica_identity: "DEFAULT",
            bytes: 0,
            size: "0 bytes",
            live_rows_estimate: 0,
            dead_rows_estimate: 0,
            comment: t.comment,
        })),
        foreignTables: [],
        views: views.map((v) => ({
            id: relationId(v),
            schema: v.schema,
            name: v.name,
            is_updatable: false,
            comment: v.comment,
        })),
        materializedViews: [],
        columns: [
            ...tables.flatMap((t) => t.columns.map((c) => column(t, c, true))),
            ...views.flatMap((v) => (v.columns ?? []).map((c) => column({ ...v, constraints: [] }, c, false))),
        ],
        primaryKeys: tables.flatMap((t) => (t.constraints.find((k) => k.type === "p")?.columns ?? []).map((name) => ({
            schema: t.schema,
            table_name: t.name,
            name,
            table_id: relationId(t),
        }))),
        relationships: tables.flatMap((t) => t.constraints.flatMap((k) => {
            const references = k.references;
            if (k.type !== "f" ||
                references === null ||
                !included(references.schema))
                return [];
            return [
                {
                    foreign_key_name: k.name,
                    schema: t.schema,
                    relation: t.name,
                    columns: [...k.columns],
                    is_one_to_one: t.constraints.some((u) => (u.type === "p" || u.type === "u") &&
                        u.columns.join() === k.columns.join()),
                    referenced_schema: references.schema,
                    referenced_relation: references.table,
                    referenced_columns: [...references.columns],
                },
            ];
        })),
        functions: [],
        types: description.enums.map((e) => ({
            id: oid(`type.${e.schema}.${e.name}`),
            name: e.name,
            schema: e.schema,
            format: e.schema === "public" ? e.name : `${e.schema}.${e.name}`,
            enums: [...e.labels],
            attributes: [],
            comment: e.comment,
            type_relation_id: null,
        })),
        rpcFunctions: [],
    };
};
