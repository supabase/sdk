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

// Explicit content-type on both body and response forces application/octet-stream
// in OpenAPI (TypeSpec defaults bytes to application/json without it).
model OctetStreamResponse {
  @statusCode statusCode: 200;
  @header contentType: "application/octet-stream";
  @body body: bytes;
}

// ─── Operations ────────────────────────────────────────────────────────────
//
// TypeSpec, like Smithy, requires a fixed HTTP method per operation.
// FunctionsClient.invoke() dispatches to the appropriate generated method
// at runtime based on FunctionInvokeOptions.method.
//
// Advantage over Smithy: TypeSpec's interface groups these naturally vs
// Smithy's flat list at the service level.
//
// Known limitation: FunctionInvokeOptions.query (dynamic query params)
// cannot be modelled here — requires middleware URL-rewriting in each SDK.

@route("/functions/v1")
interface FunctionInvocations {
  @get
  @route("/{functionName}")
  invokeGet(
    @path functionName: string,
    @header("x-region") region?: string,
  ): OctetStreamResponse | FunctionsError;

  @post
  @route("/{functionName}")
  invokePost(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType?: "application/octet-stream",
    @body body?: bytes,
  ): OctetStreamResponse | FunctionsError;

  @put
  @route("/{functionName}")
  invokePut(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType?: "application/octet-stream",
    @body body?: bytes,
  ): OctetStreamResponse | FunctionsError;

  @patch
  @route("/{functionName}")
  invokePatch(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType?: "application/octet-stream",
    @body body?: bytes,
  ): OctetStreamResponse | FunctionsError;

  @delete
  @route("/{functionName}")
  invokeDelete(
    @path functionName: string,
    @header("x-region") region?: string,
    @header contentType?: "application/octet-stream",
    @body body?: bytes,
  ): OctetStreamResponse | FunctionsError;
}
