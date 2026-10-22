import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

namespace PostgREST;

/**
 * OpenAPI 2.0 (Swagger) description of the selected schema, generated from the
 * schema cache, or the result of the `db-root-spec` function when set.
 */
model OpenApiDocument is Record<unknown>;

/** The OpenAPI description. */
model OpenApiResponse {
  @statusCode statusCode: 200;
  ...CommonResponseHeaders;
  @header("Content-Type") contentType: "application/openapi+json";
  @body body: OpenApiDocument;
}

/**
 * The root path. It describes the tables, views and functions that the request
 * role can access, unless `openapi-mode` is `ignore-privileges` (describes
 * everything) or `disabled` (PGRST126).
 */
@route("/")
@tag("OpenAPI")
interface Root {
  /** Returns the OpenAPI description of the selected schema. */
  @summary("Get the OpenAPI description")
  @get
  describe(...AcceptHeader, ...AcceptProfileHeader):
    | OpenApiResponse
    | CommonErrors;

  /** Same as `describe`, without a response body. */
  @summary("Get the OpenAPI description headers")
  @head
  describeHead(...AcceptHeader, ...AcceptProfileHeader):
    | {
        @statusCode statusCode: 200;
        ...CommonResponseHeaders;
      }
    | HeadError;
}
