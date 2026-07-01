import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

// ─── PostgREST Service ─────────────────────────────────────────────────────
//
// Models the PostgREST HTTP API boundary — paths, HTTP methods, standard
// headers, and the response envelope. The query builder layer (select,
// filters, order, limit, offset) stays hand-written in each SDK because
// PostgREST's filter syntax (id=eq.5, name=like.*foo*) is generated
// dynamically at runtime and cannot be expressed as fixed TypeSpec shapes.
//
// The @query Record<string> captures those dynamic params at the HTTP
// boundary — the generator emits a Map<String, String> (or equivalent)
// parameter that the query builder populates. This is the TypeSpec
// equivalent of Smithy's @httpQueryParams map.

@service
@info({
  title: "Supabase PostgREST API",
  version: "1.0",
})
@server("{baseUrl}", "Supabase PostgREST endpoint", {
  baseUrl: string,
})
namespace Supabase.PostgREST;

// ─── Shared ────────────────────────────────────────────────────────────────

@error
model PostgRESTError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

// Common response headers returned by PostgREST.
// body: unknown maps to {} in JSON Schema — any JSON value (object or array of row objects).
model RowsResponse {
  @statusCode statusCode: 200;
  @header("Content-Range") contentRange?: string;
  @header("Preference-Applied") preferenceApplied?: string;
  @body body: unknown;
}

// INSERT returns 201.
model InsertResponse {
  @statusCode statusCode: 201;
  @header("Content-Range") contentRange?: string;
  @header("Preference-Applied") preferenceApplied?: string;
  @body body: unknown;
}

// ─── Operations ────────────────────────────────────────────────────────────

// TypeSpec advantage: interface groups all table-level operations cleanly.
// Smithy lists them flat under the service.

@route("/{table}")
interface TableOperations {
  // SELECT — dynamic query params carry the filter expression built by the SDK
  // query builder: ?select=id,name&status=eq.active&order=created_at.desc
  @get
  from(
    @path table: string,
    @query(#{explode: true}) params?: Record<string>,
    @header("Range") range?: string,
    @header("Prefer") prefer?: string,
    @header("Accept-Profile") acceptProfile?: string,
  ): RowsResponse | PostgRESTError;

  // INSERT
  @post
  insert(
    @path table: string,
    @query(#{explode: true}) params?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @body body: unknown,
  ): InsertResponse | PostgRESTError;

  // UPSERT
  @put
  upsert(
    @path table: string,
    @query(#{explode: true}) params?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @body body: unknown,
  ): RowsResponse | PostgRESTError;

  // UPDATE
  @patch
  update(
    @path table: string,
    @query(#{explode: true}) params?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @body body: unknown,
  ): RowsResponse | PostgRESTError;

  // DELETE
  @delete
  deleteRows(
    @path table: string,
    @query(#{explode: true}) params?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
  ): RowsResponse | PostgRESTError;
}

// RPC — call a Postgres function via PostgREST.
@route("/rpc/{functionName}")
interface RpcOperations {
  @post
  rpc(
    @path functionName: string,
    @query(#{explode: true}) params?: Record<string>,
    @header("Prefer") prefer?: string,
    @header("Content-Profile") contentProfile?: string,
    @header("Accept-Profile") acceptProfile?: string,
    @body body: unknown,
  ): unknown | PostgRESTError;
}
