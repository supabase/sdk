# Supabase TypeSpec Models

Canonical [TypeSpec](https://typespec.io/) definitions for the Supabase HTTP APIs — a direct parallel to the Smithy models in `../smithy/` for comparing the two IDLs as source-of-truth candidates for SDK codegen.

## Structure

```
typespec/
  main.tsp                    # Entry point — imports all service files
  storage.tsp                 # Supabase Storage API (buckets, objects, TUS resumable uploads)
  functions.tsp               # Supabase Edge Functions API (invoke: GET/POST/PUT/PATCH/DELETE)
  postgrest.tsp               # Supabase PostgREST API (table CRUD + RPC)
  openapi/
    @typespec/openapi3/       # Generated OpenAPI 3.0 — committed for SDK consumers
      openapi.Supabase.Storage.yaml
      openapi.Supabase.Functions.yaml
      openapi.Supabase.PostgREST.yaml
  tspconfig.yaml              # TypeSpec build config
  package.json                # TypeSpec compiler + emitter dependencies
```

> **Note on output path**: TypeSpec always namespaces emitter output under `{output-dir}/@typespec/openapi3/` to prevent conflicts when multiple emitters share the same output directory. This is intentional but differs from Smithy's flat `openapi/` layout (a tooling ergonomics difference, not a modelling one).

## Compiling

**Requirements:** Node.js 18+

```bash
cd typespec
npm install
npx tsp compile .       # emits openapi/@typespec/openapi3/ from tspconfig.yaml
```

The committed files are the direct compiler outputs — no post-generation patching needed (unlike the Smithy equivalents, which require `patch-openapi.py` to fix binary format).

## Services modelled

### Storage (`storage.tsp`)

Covers the full Supabase Storage HTTP API, grouped into TypeSpec interfaces:

| Interface | Operations |
|-----------|-----------|
| `Buckets` | `list`, `get`, `create`, `update`, `empty`, `delete` |
| `Objects` | `move`, `copy`, `deleteObjects`, `list`, `info`, `head`, `createSignedUrl`, `createSignedUrls`, `createSignedUploadUrl` |
| `TusUploads` | `create` (POST 201), `uploadChunk` (PATCH 204), `getOffset` (HEAD) |

### Functions (`functions.tsp`)

One interface `FunctionInvocations` with one operation per HTTP method on `/functions/v1/{functionName}`.

### PostgREST (`postgrest.tsp`)

Two interfaces: `TableOperations` (SELECT/INSERT/UPSERT/UPDATE/DELETE on `/{table}`) and `RpcOperations` (`/rpc/{fn}`). Dynamic query params use `Record<string>` — the TypeSpec equivalent of Smithy's `@httpQueryParams map`.

## Smithy vs TypeSpec comparison

### Syntax

| Concern | Smithy | TypeSpec |
|---------|--------|---------|
| Service declaration | `@restJson1 service Foo { operations: [...] }` | `@service namespace Foo;` |
| Operation | `operation Foo { input: ..., output: ... }` | `op foo(...): ReturnType` (inline params) |
| Grouping | Flat list under `service` | `interface` groups (idiomatic, cleaner) |
| Structure | `structure Foo { @required bar: String }` | `model Foo { bar: string }` with `?` for optional |
| Error type | `@error("client") structure FooError` | `@error model FooError` |
| HTTP method | `@http(method: "GET", uri: "/foo", code: 200)` | `@get @route("/foo")` (separate decorators) |
| Path param | `@httpLabel id: String` | `@path id: string` (inline in op params) |
| Header | `@httpHeader("X-Foo") foo: String` | `@header("X-Foo") foo: string` |
| Query params (dynamic) | `@httpQueryParams params: QueryParams` | `@query params?: Record<string>` |
| Payload | `@httpPayload body: Blob` | `@body body: bytes` |
| JSON rename | `@jsonName("public") isPublic: Boolean` | `@encodedName("application/json", "public") isPublic: boolean` |
| Streaming | `@streaming blob ChunkBody` | `bytes` (no streaming annotation; maps to `format: binary`) |

### Limitations found (TypeSpec)

| # | Gap | Notes |
|---|-----|-------|
| 1 | No `@streaming` equivalent | `bytes` emits `format: binary` in OpenAPI 3.0 directly — this is actually **better** than Smithy, which emits `format: byte` (base64) and requires `patch-openapi.py` to fix |
| 2 | No native `multipart/form-data` support | Same gap as Smithy; direct upload (`UploadObject`/`UpdateObject`) requires manual OpenAPI injection or a `@typespec/multipart` workaround |
| 3 | Fixed HTTP method per operation | Same constraint as Smithy — Functions needs 5 separate operations |
| 4 | Dynamic query params via `Record<string>` | Smithy uses a dedicated `@httpQueryParams` trait; TypeSpec uses `@query Record<string>` — both generate the same OpenAPI `additionalProperties` pattern |
| 5 | Realtime (WebSocket) | Out of scope in both IDLs |

### TypeSpec advantages over Smithy

1. **No patching needed for binary**: `bytes` → `format: binary` in OpenAPI out of the box. Smithy requires `patch-openapi.py` to correct `format: byte`.
2. **Interface grouping**: Operations are organized into `interface`s rather than a flat list under `service`, matching how SDK code is structured.
3. **Inline operation parameters**: `op foo(@path id: string, @body body: Foo): Bar` is more readable than separate `input`/`output` structure declarations.
4. **Native npm ecosystem**: `npm install` + `npx tsp compile` vs Smithy CLI (Java) or Gradle. Easier CI integration, no JVM dependency.
5. **HTTP client emitters**: `@typespec/http-client-js`, `@typespec/http-client-python`, `@typespec/http-client-csharp` are first-party and actively maintained. Smithy's equivalents are AWS-specific or require custom plugins.
6. **TypeScript-native**: TypeSpec is authored in TypeScript, making it easier to write custom emitters (e.g., Swift, Dart, Kotlin) if the first-party ones don't exist.

### Smithy advantages over TypeSpec

1. **Maturity**: Smithy has been in production at AWS since ~2019. TypeSpec hit 1.0 in 2025.
2. **`smithy-kotlin`**: First-class Kotlin/KMP emitter from AWS. No TypeSpec equivalent yet.
3. **Explicit semantic traits**: `@readonly`, `@idempotent` carry semantic meaning for SDK generators beyond HTTP. TypeSpec uses `@get`/`@put` which imply but don't enforce these.

## Generator toolchains by SDK

| SDK | Smithy path | TypeSpec path |
|-----|-------------|---------------|
| Swift | `swift-openapi-generator` (spike done — [PR #1047](https://github.com/supabase/supabase-swift/pull/1047)) | Same — TypeSpec OpenAPI 3.0 output is compatible |
| JavaScript/TypeScript | `@hey-api/openapi-ts` or `@typespec/http-client-js` | `@typespec/http-client-js` (first-party, compiles directly from `.tsp`) |
| Python | `openapi-python-client` or `@typespec/http-client-python` | `@typespec/http-client-python` (first-party) |
| Dart/Flutter | `openapi-generator dart-dio` | Same — via OpenAPI artifact |
| C# | Kiota or `@typespec/http-client-csharp` | `@typespec/http-client-csharp` (first-party) |
| Go | `oapi-codegen` or `ogen` | Same — via OpenAPI artifact |
| Kotlin | `smithy-kotlin` (best Smithy option) | Via OpenAPI artifact + `openapi-generator kotlin` |

## Reference

- RFC: [Auto-generating parts of the Supabase SDKs](https://linear.app/supabase/project/rfc-auto-generating-parts-of-the-supabase-sdks-581579f2a632)
- Smithy models: [`../smithy/`](../smithy/)
- TypeSpec docs: https://typespec.io/docs
- Linear spike issues: SDK-1103 (Swift) · SDK-1104 (JS) · SDK-1105 (Python) · SDK-1106 (Dart) · SDK-1107 (C#) · SDK-1108 (Go) · SDK-1109 (Kotlin)
