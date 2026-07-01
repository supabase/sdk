import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service
@info({
  title: "Supabase Edge Functions API",
  version: "1.0",
})
@server("{baseUrl}", "Supabase Edge Functions endpoint", {
  baseUrl: string,
})
namespace Supabase.Functions;

// ─── Shared Shapes ─────────────────────────────────────────────────────────

@error
model FunctionsError {
  message?: string;
}

// A single response model covers all content types a function can return.
// Using a variable contentType header alongside bytes makes TypeSpec emit
// content-type */* in OpenAPI, which swift-openapi-generator maps to
//   case any(HTTPBody)
// This is generic enough for JSON, binary, text, event-stream, etc.
model FunctionResponse {
  @statusCode statusCode: 200;
  @header contentType: string;
  @body body: bytes;
}

// ─── Operations ────────────────────────────────────────────────────────────
//
// Each HTTP method is a single operation. The request body uses a variable
// contentType header + bytes, which TypeSpec emits as content-type */* in
// OpenAPI → HTTPBody in Swift. Callers set the actual Content-Type header
// via middleware when constructing the request.
//
// Known limitation: FunctionInvokeOptions.query (dynamic query params)
// cannot be modelled here — requires middleware URL-rewriting in each SDK.

@route("/functions/v1")
interface FunctionInvocations {
  // GET — no request body; params pass in the URL
  @get
  @route("/{functionName}")
  invokeGet(
    @path functionName: string,
    @header("x-region") region?: string,
  ): FunctionResponse | FunctionsError;

  @post
  @route("/{functionName}")
  invokePost(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType: string,
    @body body?: bytes,
  ): FunctionResponse | FunctionsError;

  @put
  @route("/{functionName}")
  invokePut(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType: string,
    @body body?: bytes,
  ): FunctionResponse | FunctionsError;

  @patch
  @route("/{functionName}")
  invokePatch(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType: string,
    @body body?: bytes,
  ): FunctionResponse | FunctionsError;

  @delete
  @route("/{functionName}")
  invokeDelete(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType: string,
    @body body?: bytes,
  ): FunctionResponse | FunctionsError;
}
