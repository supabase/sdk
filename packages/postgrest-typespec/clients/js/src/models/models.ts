/**
 * Represent a URL string as described by https://url.spec.whatwg.org/
 */
export type Url = string;
/**
 * A sequence of textual characters.
 */
export type String = string;
/**
 * Name of a table, view or function in the exposed schema, as it appears in the
 * URL. Names are case sensitive. Percent-encode spaces and non-ASCII characters
 * (`Order%20Items`, `%D9%85%D9%88%D8%A7%D8%B1%D8%AF`).
 */
export type ResourceName = string;
/**
 * Vertical filtering: the comma-separated list of fields to return. Defaults to
 * `*` (all columns).
 *
 * Each item is one of:
 *
 * - a column or computed field: `first_name`, `*`
 * - a JSON, composite or array path with `->` (JSON) and `->>` (text):
 * `json_data->phones->0->>number`
 * - an aliased item: `fullName:full_name`
 * - a cast item: `salary::text`
 * - an aggregate (when `db-aggregates-enabled`): `amount.sum()`, `amount.avg()::int`,
 * `count()`. See `AggregateFunction`. Non-aggregated items become the GROUP BY.
 * - an embedded resource with its own select list:
 * `directors(id,last_name)`, `director:directors(*)`, `directors()` (embed
 * used only for filtering, not returned)
 * - an embedding hint to pick a foreign key, column or join table, and an
 * optional join type: `addresses!billing(name)`, `actors!inner(*)`,
 * `clients!client_id!left(*)`. See `EmbeddingJoinType`.
 * - a spread embedded resource whose fields are lifted into the parent object:
 * `...directors(first_name)`. On a to-many relationship each field becomes an
 * array.
 *
 * Wrap identifiers that contain reserved characters (`,` `.` `:` `*` `(` `)`)
 * in double quotes.
 */
export type SelectList = string;
/**
 * Value of a logical operator query parameter (`or`, `and`, `not.or`,
 * `not.and`, and their embedded forms such as `actors.or`): a parenthesized,
 * comma-separated list of conditions.
 *
 * Each condition is either `<field>.<filter expression>` (for example
 * `age.lt.18`, `age.not.in.(1,2)`) or a nested logical operator
 * (`not.and(age.gte.11,age.lte.17)`). An embedded resource can be tested for
 * existence with `<embedded>.is.null` or `<embedded>.not.is.null`.
 */
export type LogicalExpression = string;
/**
 * Comma-separated list of ordering terms. Each term is
 * `<field>[.asc|.desc][.nullsfirst|.nullslast]`, where `<field>` is a column, a
 * JSON/composite path (`location->>lat`) or, on a to-one embedded resource, an
 * embedded column (`directors(last_name)`). The default direction is ascending.
 */
export type OrderList = string;
/**
 * Number of rows.
 */
export type RowCount = number;
/**
 * An integer that can be serialized to JSON (`−9007199254740991 (−(2^53 − 1))` to `9007199254740991 (2^53 − 1)` )
 */
export type Safeint = number;
/**
 * A 64-bit integer. (`-9,223,372,036,854,775,808` to `9,223,372,036,854,775,807`)
 */
export type Int64 = bigint;
/**
 * A whole number. This represent any `integer` value possible.
 * It is commonly represented as `BigInteger` in some languages.
 */
export type Integer = number;
/**
 * A numeric type
 */
export type Numeric = number;
/**
 * Media types for the `Accept` request header. Any other value selects a media
 * type handler defined in the database, and fails with PGRST107 when none
 * exists. The header can list several media types with quality values.
 */
export type AcceptMediaType = "application/json" | "text/csv" | "application/vnd.pgrst.object+json" | "application/vnd.pgrst.array+json" | "application/vnd.pgrst.array+json;nulls=stripped" | "application/geo+json" | "application/vnd.pgrst.plan" | "application/vnd.pgrst.plan+text" | "application/vnd.pgrst.plan+json" | "application/openapi+json" | "*/*" | string;
/**
 * Item range for pagination, as `<first>-<last>` or the open-ended
 * `<first>-`. Indexes are zero-based and inclusive.
 */
export type ItemRange = string;
/**
 * How the server treats invalid or unfulfillable preferences. `lenient` (the
 * default) ignores them. `strict` rejects the request with PGRST122.
 */
export type HandlingPreference = "handling=lenient" | "handling=strict";
/**
 * Time zone for the transaction: any name in `pg_timezone_names` or a numeric
 * offset such as `05:30` or `-03:00`. An invalid time zone is always an error,
 * also with `handling=lenient`.
 */
export type TimezonePreference = string;
/**
 * Whether the transaction ends in COMMIT or ROLLBACK. The server honors it only
 * when `db-tx-end` allows it.
 */
export type TxPreference = "tx=commit" | "tx=rollback";
/**
 * Asks for the total number of rows, returned as the total in `Content-Range`.
 */
export type CountPreference = "count=exact" | "count=planned" | "count=estimated";
/**
 * A GeoJSON FeatureCollection (RFC 7946).
 */
export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
}
/**
 * Represent a byte array
 */
export type Bytes = Uint8Array;
/**
 * Comma-separated list of column names.
 */
export type ColumnList = string;
/**
 * What a write request returns.
 */
export type ReturnPreference = "return=minimal" | "return=headers-only" | "return=representation";
/**
 * Upsert behavior on a primary key or `on_conflict` conflict.
 */
export type ResolutionPreference = "resolution=merge-duplicates" | "resolution=ignore-duplicates";
/**
 * Value for columns missing from the payload. The default is NULL. With
 * `missing=default` the column DEFAULT is used.
 */
export type MissingPreference = "missing=default";
/**
 * Upper bound for the number of rows a PATCH, DELETE or table-valued function
 * call can affect. Enforced only with `handling=strict`. Exceeding it fails
 * with PGRST124.
 */
export type MaxAffectedPreference = string;
