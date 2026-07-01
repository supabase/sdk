# Supabase Smithy Models

Canonical [Smithy IDL](https://smithy.io/) definitions for the Supabase HTTP APIs. These models are the shared source-of-truth for SDK codegen spikes — each SDK team runs their own generator toolchain against the same models.

## Structure

```
smithy/
  model/
    common.smithy        # Shared shapes (StringList, etc.)
    storage.smithy       # Supabase Storage API (buckets, objects, TUS resumable uploads)
    functions.smithy     # Supabase Edge Functions API (invoke: GET/POST/PUT/PATCH/DELETE)
  openapi/
    StorageService.openapi.json   # Generated OpenAPI 3.0 — committed for SDK consumers
    FunctionsService.openapi.json # Generated OpenAPI 3.0 — committed for SDK consumers
  smithy-build.json      # Smithy build config (Smithy CLI / Gradle)
  patch-openapi.py       # Post-generation patches (see Known Limitations)
  README.md
```

## Generating the OpenAPI artifacts

**Requirements:** [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli-installation.html) or Gradle with the Smithy Gradle plugin.

```bash
cd smithy
smithy build        # emits openapi/ into smithy/build/smithy/*/openapi/
python patch-openapi.py build/smithy/storage-openapi/openapi/StorageService.openapi.json
python patch-openapi.py build/smithy/functions-openapi/openapi/FunctionsService.openapi.json
```

The committed files in `openapi/` are the patched outputs — SDK teams can consume them directly without installing Smithy.

## Services modelled

### Storage (`model/storage.smithy`)

Covers the full Supabase Storage HTTP API:

| Group | Operations |
|-------|-----------|
| Buckets | `ListBuckets`, `GetBucket`, `CreateBucket`, `UpdateBucket`, `EmptyBucket`, `DeleteBucket` |
| Objects | `MoveObject`, `CopyObject`, `DeleteObjects`, `ListObjects`, `GetObjectInfo`, `HeadObject` |
| Signed URLs | `CreateSignedUrl`, `CreateSignedUrls`, `CreateSignedUploadUrl` |
| Direct upload | `UploadObject` (POST multipart), `UpdateObject` (PUT multipart) — OpenAPI-only; see Known Limitations |
| TUS resumable | `CreateTusUpload` (POST), `UploadChunk` (PATCH), `GetUploadOffset` (HEAD) |

### Functions (`model/functions.smithy`)

Models all five HTTP methods on `/functions/v1/{functionName}`:

`InvokeFunctionGet`, `InvokeFunctionPost`, `InvokeFunctionPut`, `InvokeFunctionPatch`, `InvokeFunctionDelete`

Smithy requires one operation per HTTP method — a dispatch switch in the client maps `FunctionInvokeOptions.method` to the right operation at runtime.

## Known Limitations

These are gaps found during the Swift spike (see [SDK-1103](https://linear.app/supabase/issue/SDK-1103)) that require workarounds or are out of scope for codegen:

| # | Gap | Workaround |
|---|-----|-----------|
| 1 | `@streaming blob` emits `format: byte` (base64) in OpenAPI; generators need `format: binary` | `patch-openapi.py` rewrites the format after generation |
| 2 | No native `multipart/form-data` trait in Smithy | `patch-openapi.py` injects `UploadObject`/`UpdateObject` multipart operations directly into the OpenAPI JSON |
| 3 | Smithy requires a fixed HTTP method per operation; Functions supports any method at runtime | Model 5 separate operations; client dispatches at runtime |
| 4 | `GET` + `@httpPayload` is illegal in Smithy | Separate `InvokeFunctionGetInput` shape without a body |
| 5 | Dynamic query parameters (`FunctionInvokeOptions.query`) cannot be expressed in Smithy | Not in model; requires a middleware URL-rewriting approach in each SDK |
| 6 | Realtime (WebSocket / event-emitter) is incompatible with REST codegen | Out of scope; Realtime stays hand-written in all SDKs |

## Scope for SDK spikes

The models here cover **Storage** and **Functions**. Each SDK spike (see Linear issues SDK-1103 through SDK-1109) must also verify **Auth** and **PostgREST**:

- **Auth** — sign-in/up, token refresh, OTP, OAuth redirects, session management
- **PostgREST** — query building (`.select()`, `.eq()`, `.order()`) uses highly dynamic query strings; the question is whether codegen helps at the transport layer even if the query builder stays hand-written

Auth and PostgREST models do not exist yet. They may need to be added here, or the teams may determine that those layers are unsuitable for codegen (PostgREST in particular).

## Generator toolchains by SDK

Each SDK team runs their own generator against the OpenAPI artifacts:

| SDK | Candidate toolchain |
|-----|-------------------|
| Swift | `swift-openapi-generator` (spike done — see [PR #1047](https://github.com/supabase/supabase-swift/pull/1047)) |
| JavaScript/TypeScript | TypeSpec → `@hey-api/openapi-ts` or `@typespec/http-client-js` |
| Python | TypeSpec → `openapi-python-client` or `@typespec/http-client-python` |
| Dart/Flutter | OpenAPI Generator `dart-dio` (no official TypeSpec/Smithy Dart emitter) |
| C# | Kiota or `@typespec/http-client-csharp` |
| Go | `oapi-codegen` or `ogen` |
| Kotlin | `smithy-kotlin` (KMP-compatible) or custom TypeSpec emitter |

## Reference

- RFC: [Auto-generating parts of the Supabase SDKs](https://linear.app/supabase/project/rfc-auto-generating-parts-of-the-supabase-sdks-581579f2a632)
- Swift spike PR: [supabase/supabase-swift#1047](https://github.com/supabase/supabase-swift/pull/1047)
- Linear spike issues: SDK-1103 (Swift) · SDK-1104 (JS) · SDK-1105 (Python) · SDK-1106 (Dart) · SDK-1107 (C#) · SDK-1108 (Go) · SDK-1109 (Kotlin)
