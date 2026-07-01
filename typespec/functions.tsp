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
//
// Each HTTP method is expressed as a group of @sharedRoute operations — one per
// supported request body content type — that TypeSpec merges into a single OpenAPI
// operation with multiple requestBody.content entries. swift-openapi-generator
// maps those to a Body enum with one case per content type:
//   .json(OpenAPIValueContainer)
//   .binary(HTTPBody)
//   .plainText(String)
//   .urlEncoded(String)
//
// The operationId override (@operationId) avoids the auto-generated
// concatenated name TypeSpec would otherwise produce for sharedRoute groups.

@route("/functions/v1")
interface FunctionInvocations {
  // GET has no request body — functions called with GET pass params in the URL.
  @get
  @route("/{functionName}")
  invokeGet(
    @path functionName: string,
    @header("x-region") region?: string,
  ): OctetStreamResponse | FunctionsError;

  // POST — one @sharedRoute variant per supported content type.
  @sharedRoute @post @route("/{functionName}") @operationId("FunctionInvocations_invokePost")
  invokePostJson(@path functionName: string, @header("x-region") region?: string, @body body?: unknown): OctetStreamResponse | FunctionsError;
  @sharedRoute @post @route("/{functionName}") invokePostBinary(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/octet-stream", @body body?: bytes): OctetStreamResponse | FunctionsError;
  @sharedRoute @post @route("/{functionName}") invokePostText(@path functionName: string, @header("x-region") region?: string, @header contentType: "text/plain", @body body?: string): OctetStreamResponse | FunctionsError;
  @sharedRoute @post @route("/{functionName}") invokePostForm(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/x-www-form-urlencoded", @body body?: string): OctetStreamResponse | FunctionsError;

  // PUT
  @sharedRoute @put @route("/{functionName}") @operationId("FunctionInvocations_invokePut")
  invokePutJson(@path functionName: string, @header("x-region") region?: string, @body body?: unknown): OctetStreamResponse | FunctionsError;
  @sharedRoute @put @route("/{functionName}") invokePutBinary(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/octet-stream", @body body?: bytes): OctetStreamResponse | FunctionsError;
  @sharedRoute @put @route("/{functionName}") invokePutText(@path functionName: string, @header("x-region") region?: string, @header contentType: "text/plain", @body body?: string): OctetStreamResponse | FunctionsError;
  @sharedRoute @put @route("/{functionName}") invokePutForm(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/x-www-form-urlencoded", @body body?: string): OctetStreamResponse | FunctionsError;

  // PATCH
  @sharedRoute @patch @route("/{functionName}") @operationId("FunctionInvocations_invokePatch")
  invokePatchJson(@path functionName: string, @header("x-region") region?: string, @body body?: unknown): OctetStreamResponse | FunctionsError;
  @sharedRoute @patch @route("/{functionName}") invokePatchBinary(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/octet-stream", @body body?: bytes): OctetStreamResponse | FunctionsError;
  @sharedRoute @patch @route("/{functionName}") invokePatchText(@path functionName: string, @header("x-region") region?: string, @header contentType: "text/plain", @body body?: string): OctetStreamResponse | FunctionsError;
  @sharedRoute @patch @route("/{functionName}") invokePatchForm(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/x-www-form-urlencoded", @body body?: string): OctetStreamResponse | FunctionsError;

  // DELETE
  @sharedRoute @delete @route("/{functionName}") @operationId("FunctionInvocations_invokeDelete")
  invokeDeleteJson(@path functionName: string, @header("x-region") region?: string, @body body?: unknown): OctetStreamResponse | FunctionsError;
  @sharedRoute @delete @route("/{functionName}") invokeDeleteBinary(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/octet-stream", @body body?: bytes): OctetStreamResponse | FunctionsError;
  @sharedRoute @delete @route("/{functionName}") invokeDeleteText(@path functionName: string, @header("x-region") region?: string, @header contentType: "text/plain", @body body?: string): OctetStreamResponse | FunctionsError;
  @sharedRoute @delete @route("/{functionName}") invokeDeleteForm(@path functionName: string, @header("x-region") region?: string, @header contentType: "application/x-www-form-urlencoded", @body body?: string): OctetStreamResponse | FunctionsError;
}
