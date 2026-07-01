import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

// ─── PostgREST Service ─────────────────────────────────────────────────────
//
// Models the PostgREST HTTP API boundary — paths, HTTP methods, standard
// headers, query params, and response headers.
//
// Fixed query params (select, order, limit, offset) are named members so
// generators emit them as typed, documented parameters. Dynamic column
// filters (e.g. ?id=eq.5&name=like.*foo*) cannot be enumerated statically;
// they are expressed via a `filters: Record<string>` member with `explode: true`,
// which expands each key-value pair into its own query parameter.
//
// The query builder layer (.eq(), .like(), .order(), etc.) stays hand-written
// in each SDK — it populates the filters map at runtime. The model only
// describes the HTTP boundary contract.

@service
@info({
  title: "Supabase PostgREST API",
  version: "1.0",
})
@server("{baseUrl}", "Supabase PostgREST endpoint", {
  baseUrl: string,
})
namespace Supabase.PostgREST;

// ─── Shared types ─────────────────────────────────────────────────────────

@error
model PostgRESTError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/** PostgREST column filter operators.
 *  Format a filter value as "{operator}.{value}", e.g. "eq.5".
 *  Prefix with "not." to negate: "not.eq.5".
 *  For logical grouping use keys "or" / "and" in the filters map.
 */
enum FilterOperator {
  eq,
  neq,
  lt,
  lte,
  gt,
  gte,
  like,
  ilike,
  match,
  imatch,
  `is`,
  isdistinct,
  `in`,
  cs,
  cd,
  ov,
  sl,
  sr,
  nxl,
  nxr,
  adj,
  fts,
  plfts,
  phfts,
  wfts,
}

// Common response returned by SELECT, UPDATE, UPSERT, DELETE.
// bytes + explicit application/octet-stream content-type emits format:binary in OpenAPI,
// which swift-openapi-generator maps to HTTPBody — letting the SDK layer decode the
// raw JSON into whatever Decodable type the caller requested.
model RowsResponse {
  @statusCode statusCode: 200;
  @header contentType: "application/octet-stream";
  @header("Content-Range") contentRange?: string;
  @header("Preference-Applied") preferenceApplied?: string;
  @body body: bytes;
}

// INSERT returns 201 Created.
model InsertResponse {
  @statusCode statusCode: 201;
  @header contentType: "application/octet-stream";
  @header("Content-Range") contentRange?: string;
  @header("Preference-Applied") preferenceApplied?: string;
  @body body: bytes;
}

// ─── Operations ────────────────────────────────────────────────────────────

@route("/{table}")
interface TableOperations {
  /** SELECT rows from a table.
   *
   * Fixed params (select, order, limit, offset) are named so generators emit
   * typed, documented parameters. Column filters are passed via `filters`:
   * each map entry becomes its own query parameter when serialized
   * (explode: true), e.g. {"id": "eq.5"} → ?id=eq.5.
   */
  @get
  from(
    @path table: string,
    /** Column selection — comma-separated list, supports aliasing, casting,
     *  embedded resources, and JSON operators. e.g. "id,name,orders(total)". */
    @query select?: string,
    /** Ordering — e.g. "name.asc,age.desc.nullslast" */
    @query order?: string,
    /** Maximum number of rows to return. */
    @query limit?: integer,
    /** Row offset for pagination. */
    @query offset?: integer,
    /** Horizontal filters — each entry becomes a separate query parameter.
     *  Key: column name (or "or"/"and" for logical groups).
     *  Value: "{operator}.{value}" e.g. {"id": "eq.5", "name": "like.foo*"}.
     *  See FilterOperator for the full operator list. */
    @query(#{explode: true}) filters?: Record<string>,
    @header("Range") range?: string,
    @header("Prefer") prefer?: string,
    @header("Accept-Profile") acceptProfile?: string,
  ): RowsResponse | PostgRESTError;

  /** INSERT rows into a table. */
  @post
  insert(
    @path table: string,
    /** Column selection for the returned representation (requires Prefer: return=representation). */
    @query select?: string,
    /** Columns hint for bulk insert. */
    @query columns?: string,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @header contentType: "application/octet-stream",
    @body body: bytes,
  ): InsertResponse | PostgRESTError;

  /** UPSERT rows (PUT). */
  @put
  upsert(
    @path table: string,
    @query select?: string,
    /** Comma-separated columns to use as the conflict target for upsert. */
    @query on_conflict?: string,
    /** Horizontal filters — each entry becomes a separate query parameter. */
    @query(#{explode: true}) filters?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @header contentType: "application/octet-stream",
    @body body: bytes,
  ): RowsResponse | PostgRESTError;

  /** UPDATE rows matching the filter. */
  @patch
  update(
    @path table: string,
    @query select?: string,
    /** Horizontal filters — each entry becomes a separate query parameter. */
    @query(#{explode: true}) filters?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @header contentType: "application/octet-stream",
    @body body: bytes,
  ): RowsResponse | PostgRESTError;

  /** DELETE rows matching the filter. */
  @delete
  deleteRows(
    @path table: string,
    @query select?: string,
    /** Horizontal filters — each entry becomes a separate query parameter. */
    @query(#{explode: true}) filters?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
  ): RowsResponse | PostgRESTError;
}

/** RPC — call a Postgres function via PostgREST. */
@route("/rpc/{functionName}")
interface RpcOperations {
  /** Call an RPC function via POST with a JSON body. */
  @post
  rpc(
    @path functionName: string,
    @query select?: string,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @header contentType: "application/octet-stream",
    @body body: bytes,
  ): RowsResponse | PostgRESTError;

  /** Call a read-only RPC function via GET.
   *  Function arguments are passed as query params (each arg is its own param). */
  @get
  rpcGet(
    @path functionName: string,
    @query select?: string,
    /** Function arguments — each entry becomes its own query parameter. */
    @query(#{explode: true}) args?: Record<string>,
    @header("Accept-Profile") acceptProfile?: string,
  ): RowsResponse | PostgRESTError;
}
