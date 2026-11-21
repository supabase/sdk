import { type GeneratorMetadata } from "@supabase/postgrest-typegen";
/**
 * The subset of Spark's schema description (`GET /_spark/v1/schema`) that
 * `sparkGeneratorMetadata` reads.
 */
export interface SparkColumn {
    readonly name: string;
    readonly position: number;
    /** `format_type` form: `text`, `integer`, `text[]`, `public.status`. */
    readonly type: string;
    readonly not_null: boolean;
    readonly default: string | null;
    /** `a` always, `d` by default. */
    readonly identity: "a" | "d" | null;
    readonly generated: string | null;
    readonly comment: string | null;
}
export interface SparkConstraint {
    readonly name: string;
    /** Primary key, unique, foreign key, check. */
    readonly type: "p" | "u" | "f" | "c";
    /** `pg_get_constraintdef` form. */
    readonly def: string;
    readonly columns: ReadonlyArray<string>;
    readonly references: {
        readonly schema: string;
        readonly table: string;
        readonly columns: ReadonlyArray<string>;
    } | null;
}
export interface SparkTable {
    readonly schema: string;
    readonly name: string;
    readonly rls_enabled: boolean;
    readonly rls_forced: boolean;
    readonly comment: string | null;
    readonly columns: ReadonlyArray<SparkColumn>;
    readonly constraints: ReadonlyArray<SparkConstraint>;
}
export interface SparkView {
    readonly schema: string;
    readonly name: string;
    readonly comment: string | null;
    /** Absent in descriptions from a Spark that predates view columns. */
    readonly columns?: ReadonlyArray<SparkColumn>;
}
export interface SparkEnum {
    readonly schema: string;
    readonly name: string;
    readonly labels: ReadonlyArray<string>;
    readonly comment: string | null;
}
export interface SparkSchemaDescription {
    /** Schemas owned by Spark or Supabase, listed so references to them resolve. */
    readonly managed_schemas: ReadonlyArray<string>;
    readonly schemas: ReadonlyArray<{
        readonly name: string;
        readonly comment: string | null;
    }>;
    readonly enums: ReadonlyArray<SparkEnum>;
    readonly tables: ReadonlyArray<SparkTable>;
    readonly views: ReadonlyArray<SparkView>;
}
/**
 * The metadata `introspect()` would read from `pg_catalog`, built from Spark's description so the
 * shared generators run unchanged. The description has no functions or composite types, so those
 * come out empty. Temporary: `introspect()` replaces this once Spark's engine exposes the catalogs
 * it reads.
 */
export declare const sparkGeneratorMetadata: (description: SparkSchemaDescription, options: {
    readonly schemas: ReadonlyArray<string>;
}) => GeneratorMetadata;
