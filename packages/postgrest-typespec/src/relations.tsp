import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

namespace PostgREST;

/** Path of a table or view. */
model RelationPath {
  /** Table or view in the selected schema. */
  @path relation: ResourceName;
}

/** Headers of a read response. */
alias ReadResponseHeaders = {
  ...CommonResponseHeaders;
  ...RangeResponseHeaders;
};

/** Headers of a write response. */
alias WriteResponseHeaders = {
  ...CommonResponseHeaders;

  /** With `Prefer: count=...`, the number of affected rows as the total. */
  @header("Content-Range") contentRange?: ContentRange;
};

/** Rows were inserted. No body unless `Prefer: return=representation`. */
model CreatedResponse {
  @statusCode statusCode: 201;
  ...WriteResponseHeaders;

  /**
   * With `Prefer: return=headers-only` and a primary key, the URL of the
   * created row, such as `/projects?id=eq.34`.
   */
  @header("Location") location?: string;
}

/**
 * An upsert with `Prefer: resolution=merge-duplicates` updated existing rows
 * and inserted none. No body unless `Prefer: return=representation`.
 */
model UpsertedResponse {
  @statusCode statusCode: 200;
  ...WriteResponseHeaders;
}

/** The request succeeded. No body unless `Prefer: return=representation`. */
model NoContentResponse {
  @statusCode statusCode: 204;
  ...WriteResponseHeaders;
}

/** A JSON row payload. */
model JsonBody<Body> {
  @header("Content-Type") contentType: "application/json";
  @body body: Body;
}

/** A URL-encoded payload: one key per column. */
alias FormBody = {
  @header("Content-Type") contentType: "application/x-www-form-urlencoded";
  @body body: Record<string>;
};

/**
 * A CSV payload. The first line lists the column names, without spaces after
 * the commas. An empty field is an empty string; `NULL` is SQL NULL.
 */
alias CsvBody = {
  @header("Content-Type") contentType: "text/csv";
  @body body: string;
};

op Insert<Payload extends {}>(
  ...RelationPath,
  ...SelectParameter,
  ...ColumnsParameter,
  ...OnConflictParameter,
  ...AcceptHeader,
  ...ContentProfileHeader,
  ...PreferHeader<InsertPreference>,
  ...Payload,
):
  | CreatedResponse
  | UpsertedResponse
  | RowsRepresentation<200, WriteResponseHeaders>
  | RowsRepresentation<201, WriteResponseHeaders>
  | ConflictError
  | CommonErrors;

op Upsert<Payload extends {}>(
  ...RelationPath,
  ...FilterParameters,
  ...SelectParameter,
  ...ColumnsParameter,
  ...AcceptHeader,
  ...ContentProfileHeader,
  ...PreferHeader<PutPreference>,
  ...Payload,
):
  | NoContentResponse
  | RowsRepresentation<200, WriteResponseHeaders>
  | RowsRepresentation<201, WriteResponseHeaders>
  | ConflictError
  | CommonErrors;

op Update<Payload extends {}>(
  ...RelationPath,
  ...FilterParameters,
  ...SelectParameter,
  ...ColumnsParameter,
  ...AcceptHeader,
  ...ContentProfileHeader,
  ...PreferHeader<UpdatePreference>,
  ...Payload,
):
  | NoContentResponse
  | RowsRepresentation<200, WriteResponseHeaders>
  | ConflictError
  | CommonErrors;

/**
 * Tables, views and foreign tables of the exposed schema, one route per
 * relation. The methods allowed on a relation depend on the database: views
 * need INSTEAD OF triggers (or must be auto-updatable) for writes, and PUT
 * needs a primary key. All operations run with the privileges of the request
 * role.
 */
@route("/{relation}")
@tag("Tables and Views")
interface Relations {
  /**
   * Reads rows. Supports vertical filtering (`select`), horizontal filtering,
   * ordering, pagination, resource embedding and aggregates. The response is
   * 206 Partial Content when it does not contain every row of the count.
   */
  @summary("Read rows")
  @get
  read(
    ...RelationPath,
    ...SelectParameter,
    ...FilterParameters,
    ...PaginationParameters,
    ...AcceptHeader,
    ...AcceptProfileHeader,
    ...RangeRequestHeaders,
    ...PreferHeader<ReadPreference>,
  ):
    | RowsRepresentation<200 | 206, ReadResponseHeaders>
    | AmbiguousError
    | RangeNotSatisfiableError
    | CommonErrors;

  /** Same as `read`, without a response body. */
  @summary("Read rows without a body")
  @head
  readHead(
    ...RelationPath,
    ...SelectParameter,
    ...FilterParameters,
    ...PaginationParameters,
    ...AcceptHeader,
    ...AcceptProfileHeader,
    ...RangeRequestHeaders,
    ...PreferHeader<ReadPreference>,
  ):
    | {
        @statusCode statusCode: 200 | 206;
        ...ReadResponseHeaders;
      }
    | HeadError;

  /**
   * Creates one row from a JSON object, or many rows from a JSON
   * array of objects with uniform keys or from CSV, in a single INSERT. Missing
   * keys get NULL, or the column DEFAULT with `Prefer: missing=default`.
   *
   * With `Prefer: resolution=merge-duplicates` or `resolution=ignore-duplicates`
   * the insert becomes an upsert on the primary key, or on the `on_conflict`
   * columns.
   */
  @summary("Insert or upsert rows")
  @post
  @sharedRoute
  @operationId("Relations_insert")
  insert is Insert<JsonBody<Row | Row[]>>;

  @post
  @sharedRoute
  @operationId("Relations_insert")
  insertForm is Insert<FormBody>;

  @post
  @sharedRoute
  @operationId("Relations_insert")
  insertCsv is Insert<CsvBody>;

  /**
   * Inserts the row, or replaces it when it exists. The
   * query string filters every primary key column with `eq`, and the body
   * repeats those values and gives every column. Limits and offsets are not
   * allowed (PGRST114). A body key that differs from the filter fails with
   * PGRST115.
   */
  @summary("Upsert a single row")
  @put
  @sharedRoute
  @operationId("Relations_upsert")
  upsert is Upsert<JsonBody<Row>>;

  @put
  @sharedRoute
  @operationId("Relations_upsert")
  upsertForm is Upsert<FormBody>;

  @put
  @sharedRoute
  @operationId("Relations_upsert")
  upsertCsv is Upsert<CsvBody>;

  /**
   * Sets the payload columns on every row that matches the
   * filters. Without filters every row is updated.
   */
  @summary("Update rows")
  @patch(#{ implicitOptionality: false })
  @sharedRoute
  @operationId("Relations_update")
  update is Update<JsonBody<Row>>;

  @patch(#{ implicitOptionality: false })
  @sharedRoute
  @operationId("Relations_update")
  updateForm is Update<FormBody>;

  @patch(#{ implicitOptionality: false })
  @sharedRoute
  @operationId("Relations_update")
  updateCsv is Update<CsvBody>;

  /**
   * Deletes every row that matches the filters. Without filters every row is
   * deleted.
   */
  @summary("Delete rows")
  @delete
  delete(
    ...RelationPath,
    ...FilterParameters,
    ...SelectParameter,
    ...AcceptHeader,
    ...ContentProfileHeader,
    ...PreferHeader<DeletePreference>,
  ):
    | NoContentResponse
    | RowsRepresentation<200, WriteResponseHeaders>
    | ConflictError
    | CommonErrors;
}
