import "@typespec/http";

using Http;

namespace PostgREST;

/**
 * A row of a table, view or table-valued function, as a JSON object keyed by
 * column name. Its shape depends on the database schema and on `select`
 * (aliases, casts, JSON paths, aggregates and embedded resources).
 */
model Row is Record<unknown>;

/**
 * Media types for the `Accept` request header. Any other value selects a media
 * type handler defined in the database, and fails with PGRST107 when none
 * exists. The header can list several media types with quality values.
 */
union AcceptMediaType {
  /** JSON array of rows. The default for tables, views and functions. */
  json: "application/json",

  /** CSV with a header line. */
  csv: "text/csv",

  /**
   * A single JSON object instead of an array. Fails with PGRST116 (406) when
   * the result does not have exactly one row.
   */
  object: "application/vnd.pgrst.object+json",

  /** JSON array of rows. Accepts the `nulls=stripped` parameter. */
  array: "application/vnd.pgrst.array+json",

  /** JSON array of rows, without keys whose value is null. */
  arrayStripped: "application/vnd.pgrst.array+json;nulls=stripped",

  /** GeoJSON FeatureCollection, for resources with a PostGIS geometry column. */
  geojson: "application/geo+json",

  /**
   * EXPLAIN plan of the request, in text format, when `db-plan-enabled` is on.
   * Accepts the parameters `for="<media type>"` (the representation to plan
   * for, default `application/json`) and `options=<a>|<b>` with any of
   * `analyze`, `verbose`, `settings`, `buffers` and `wal`.
   */
  plan: "application/vnd.pgrst.plan",

  /** EXPLAIN plan in text format. Same parameters as `plan`. */
  planText: "application/vnd.pgrst.plan+text",

  /** EXPLAIN plan in JSON format. Same parameters as `plan`. */
  planJson: "application/vnd.pgrst.plan+json",

  /** OpenAPI description. Only valid on the root path. */
  openapi: "application/openapi+json",

  /** JSON on resources, OpenAPI on the root path. */
  any: "*/*",

  string,
}

/** Request header `Accept`. */
alias AcceptHeader = {
  /** Media type(s) of the response. */
  @header("Accept") accept?: AcceptMediaType;
};

/** A GeoJSON FeatureCollection (RFC 7946). */
model GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: Record<unknown>[];
}

/** Rows as a JSON array. */
model JsonRows<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/json";
  @body body: Row[];
}

/** Rows as a JSON array, from `Accept: application/vnd.pgrst.array+json`. */
model ArrayRows<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/vnd.pgrst.array+json";
  @body body: Row[];
}

/** One row as a JSON object, from `Accept: application/vnd.pgrst.object+json`. */
model ObjectRow<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/vnd.pgrst.object+json";
  @body body: Row;
}

/** Rows as CSV, with a header line. */
model CsvRows<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "text/csv";
  @body body: string;
}

/** Rows as GeoJSON. */
model GeoJsonRows<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/geo+json";
  @body body: GeoJsonFeatureCollection;
}

/** EXPLAIN plan in text format. */
model TextPlan<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/vnd.pgrst.plan+text";
  @body body: string;
}

/** EXPLAIN plan in JSON format. */
model JsonPlan<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/vnd.pgrst.plan+json";
  @body body: Record<unknown>[];
}

/**
 * Output of a media type handler defined in the database. The handler sets
 * the actual `Content-Type`.
 */
model HandlerOutput<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "*/*";
  @body body: bytes;
}

/**
 * Every representation of a set of rows, selected with the `Accept` header,
 * with the given status code and headers.
 */
alias RowsRepresentation<Status, Headers extends {}> =
  | JsonRows<Status, Headers>
  | ArrayRows<Status, Headers>
  | ObjectRow<Status, Headers>
  | CsvRows<Status, Headers>
  | GeoJsonRows<Status, Headers>
  | TextPlan<Status, Headers>
  | JsonPlan<Status, Headers>
  | HandlerOutput<Status, Headers>;
