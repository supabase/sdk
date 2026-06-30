# Codegen Spike: Swift Storage SDK via openapi-generator

**Date:** 2026-06-16
**Spike type:** Discovery / read-only — no generated code committed

---

## 1. Tooling

| Item | Value |
|------|-------|
| `openapi-generator version` | **7.23.0** |
| Available Swift generators | `swift6`, `swift-combine` |
| Selected generator | **`swift6`** (most modern; `swift-combine` is also available but Combine-focused) |
| Java version | 25 (required runtime; present at `/opt/homebrew/bin/openapi-generator`) |
| Swift version | 6.3.2 |

### Key `--additional-properties` for `swift6`

| Property | Default | Notes |
|----------|---------|-------|
| `projectName` | — | Sets the Swift module name and SPM target name |
| `useSPMFileStructure` | `true` | Emits `Sources/<projectName>/` layout (use this) |
| `responseAs` | — | Set to `AsyncAwait` for async/await methods |
| `library` | `urlsession` | Also: `alamofire`, `vapor`; `urlsession` has zero external deps |
| `nonPublicApi` | `false` | Set `true` to reduce visibility for embedding |
| `hashableModels` | `true` | Models conform to `Hashable` |
| `identifiableModels` | `true` | Models conform to `Identifiable` when `id` present |
| `useClasses` | `false` | Uses structs by default (good for Swift value semantics) |
| `enumUnknownDefaultCase` | `false` | Set `true` for forward-compat with new server enum values |
| `additionalModelObjectAttributes` | — | Inject Swift attributes (e.g. `@MainActor`) into model declarations |
| `additionalModelImports` | — | Add `import` lines to every model file |
| `swiftPackagePath` | — | Override source path (alternative to `useSPMFileStructure`) |
| `apiStaticMethod` | `true` | API methods are `open class func` (static-style) |

No external package dependencies are pulled in when `library=urlsession` — the generated `Package.swift` has an empty `dependencies: []` array.

---

## 2. Spec Source

### Location

The canonical spec is **dynamically generated** by the Fastify server (using `@fastify/swagger`). It is NOT committed to the `master` branch of `supabase/storage`.

The spec is published to GitHub Pages on every push to `master` via the `docs.yml` workflow (`npm run docs:export`). The Swagger UI at `https://supabase.github.io/storage/` loads:

```
https://supabase.github.io/storage/api.json
```

### Pinnable URL

The `gh-pages` branch holds the rendered output. At time of spike the branch HEAD was:

```
SHA: 53e6a743d5b02e7e7e7b7549f7490517773be016
Date: 2026-04-28T21:30:43Z
```

Pinned raw URL (immutable at this SHA):

```
https://raw.githubusercontent.com/supabase/storage/53e6a743d5b02e7e7e7b7549f7490517773be016/api.json
```

This URL is pinnable but only as a point-in-time snapshot. The `gh-pages` branch advances with every `master` push, so the pin must be refreshed as part of any "bump spec" process. The live tip is always at `https://supabase.github.io/storage/api.json`.

### Spec Facts

| Item | Value |
|------|-------|
| Format | JSON |
| OpenAPI version | **3.0.3** |
| Title | Supabase Storage API |
| Spec `version` field | `0.0.0` |
| Total paths | 52 |
| Total operations | 108 |
| Operations with `operationId` | **0** — NONE |
| Schemas in `components/schemas` | 3 (`def-0` authSchema, `def-1` errorSchema, `def-2` vector/iceberg query schema) |
| Security scheme | `bearerAuth` (HTTP Bearer JWT) |
| API tags | `resumable`, `bucket`, `object`, `cdn`, `health`, `iceberg`, `transformation`, `s3`, `vector` |

**Critical finding: Zero `operationId`s.** Without operationIds the generator synthesizes method names from HTTP method + path (e.g. `bucketBucketIdDelete`, `objectBucketNamePost`). Names are long and ambiguous. The `binding.operationId` approach used in the broader SDK plan cannot rely on the native spec — operationIds must be injected via an overlay or a spec-preprocessing step.

**Second critical finding: Wildcard path parameters.** 15 of 52 paths use Fastify's `{*}` catch-all syntax (e.g. `/object/{bucketName}/{*}`). This is not standard OpenAPI. The generator produces malformed Swift code with an unnamed parameter (`, : String`), which fails to compile.

---

## 3. Generated Output

### File Tree (scratch at `$TMPDIR/out`)

```
Package.swift
Cartfile                          (Carthage manifest — not used with SPM)
SupabaseStorage.podspec           (CocoaPods manifest — not used)
project.yml                       (XcodeGen — not used)
Sources/SupabaseStorage/
  APIs/
    BucketAPI.swift               (bucket + iceberg-bucket ops, ~700 lines)
    CdnAPI.swift                  (CDN purge — BROKEN: wildcard param)
    HealthAPI.swift               (health check)
    IcebergAPI.swift              (Iceberg catalog protocol)
    ObjectAPI.swift               (object CRUD — BROKEN: wildcard params)
    ResumableAPI.swift            (TUS resumable — BROKEN: wildcard params)
    S3API.swift                   (S3 compat — BROKEN: wildcard params)
    TransformationAPI.swift       (image transform — BROKEN: wildcard params)
    VectorAPI.swift               (vector search)
  Infrastructure/
    APIs.swift                    (SupabaseStorageAPIConfiguration, RequestBuilder<T>)
    APIHelper.swift               (param encoding helpers)
    CodableHelper.swift           (JSON encoder/decoder configuration)
    Extensions.swift              (ParameterConvertible conformances)
    JSONDataEncoding.swift        (multipart/form-data encoding)
    JSONEncodingHelper.swift      (body encoding)
    JSONValue.swift               (AnyCodable-like type — INTERNAL)
    Models.swift                  (ErrorResponse enum — the thrown error type)
    OpenAPIMutex.swift            (thread-safe state wrapper)
    OpenISO8601DateFormatter.swift
    SynchronizedDictionary.swift
    URLSessionImplementations.swift  (URLSession-backed RequestBuilder)
    Validation.swift              (model property validation)
  Models/
    BucketSchema.swift            (Bucket entity)
    ObjectSchema.swift            (Object entity)
    Def1.swift                    (errorSchema — statusCode/error/message)
    Def0.swift                    (authSchema)
    Def2.swift                    (vector query schema)
    BucketPost200Response.swift   (response types...)
    BucketBucketIdPutRequest.swift
    ObjectListBucketNamePostRequest.swift
    ... (40+ request/response structs)
docs/                             (generated markdown docs — 72 files)
```

### Package.swift (full content)

```swift
// swift-tools-version:6.0

import PackageDescription

let package = Package(
    name: "SupabaseStorage",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15),
        .tvOS(.v13),
        .watchOS(.v6),
    ],
    products: [
        .library(
            name: "SupabaseStorage",
            targets: ["SupabaseStorage"]
        ),
    ],
    dependencies: [
        // empty — URLSession library has zero external deps
    ],
    targets: [
        .target(
            name: "SupabaseStorage",
            dependencies: [],
            path: "Sources/SupabaseStorage"
        ),
    ],
    swiftLanguageModes: [.v6]
)
```

**No external dependencies.** No AnyCodable, no Alamofire. The generator includes a local `JSONValue.swift` that provides equivalent functionality.

### Error Type

The error type in `Infrastructure/Models.swift` is `ErrorResponse` — a Swift enum with associated values. All API methods are declared `async throws(ErrorResponse)` (typed throws, Swift 6 feature). This is clean and modern.

The `def-1` schema (errorSchema) is emitted as a separate model `Def1` (with fields `statusCode: String`, `error: String`, `message: String`). `Def1` is a distinct type from `ErrorResponse` — `ErrorResponse` is the thrown error type wrapping HTTP-level errors, while `Def1` maps the Storage API's JSON error body.

### Public vs Internal Split

| Directory | Role | Public? |
|-----------|------|---------|
| `Sources/SupabaseStorage/Models/` | Domain types (request/response structs) | **Public** — re-export as-is |
| `Sources/SupabaseStorage/APIs/` | API call classes (one per tag) | **Internal** — wrap in a higher-level client |
| `Sources/SupabaseStorage/Infrastructure/` | HTTP transport (URLSession plumbing) | **Internal** — replace or re-use as implementation detail |

The generator does **not** support a models-only mode. There is no `--additional-properties=generateApiTypes=false` equivalent for `swift6`. However, the `nonPublicApi=true` flag reduces all access modifiers to `internal`, which could be used to make the API classes non-public while a hand-written facade is added as the public surface.

---

## 4. Build Result

**Build: FAILED**

```
swift build  →  Exit code 1
Error count: 2,269 (all from the same root cause)
Root cause: Wildcard path parameter `{*}` in 15 paths is not valid OpenAPI.
            The generator produces unnamed parameters: `, : String` which is
            invalid Swift syntax.
Affected API files: CdnAPI.swift, ObjectAPI.swift, ResumableAPI.swift,
                    S3API.swift, TransformationAPI.swift
```

The Models and Infrastructure files compiled successfully (77 tasks reached before the emit-module failure). The compile errors are confined entirely to the 5 affected API files. Infrastructure and Models are build-clean.

---

## 5. Template Implications

Three things a `templates/swift/` pack must handle:

### 5.1 Spec preprocessing is mandatory (not a template concern)

The raw spec cannot be fed to the generator as-is. A preprocessing step must:

1. **Inject `operationId`** on every operation (108 ops). The operationId determines Swift method names and is the hook for `binding.operationId` mappings. Strategy: derive from tag + HTTP method + a disambiguating suffix, or maintain a manual `x-operationId` overlay YAML.

2. **Rename `{*}` to a named parameter** (e.g. `{objectPath}` or `{wildcardPath}`). Standard OpenAPI path templating requires `{paramName}`. This must be done via `sed`/`jq` preprocessing or an overlay.

3. **Optionally strip Iceberg/Vector/Resumable paths** for the initial pilot — the core Storage SDK (bucket + object) is covered by ~30 of the 108 operations.

### 5.2 Template overrides for Supabase Swift style

The generated API classes use `open class func` (static methods) and a global `SupabaseStorageAPIConfiguration.shared` singleton. Supabase's Swift SDK style uses actor-isolated instance clients (`SupabaseStorageClient`). A template override for `api.mustache` should:

- Change the class to a `struct` or `actor` that holds a configuration instance
- Remove the singleton pattern
- Inject a `baseURL` computed from a Supabase project URL + `/storage/v1`
- Thread the auth token through automatically (the generated code requires explicit `bearerAuth` header management)

### 5.3 Model naming cleanup

Schemas are named `def-0`, `def-1`, `def-2` (Fastify's autogenerated names). Template overrides or a spec overlay must rename these to `StorageAuthHeaders`, `StorageError`, and `VectorQueryRequest` (or similar). The response types synthesized from path+method (e.g. `BucketBucketIdEmptyPost200Response`) should also be normalized.

---

## 6. Open Questions / Risks

| # | Issue | Severity | Suggested resolution |
|---|-------|----------|----------------------|
| 1 | **Zero operationIds** — names are path-derived, verbose, and unstable across spec updates | High | Add operationId injection as a mandatory codegen pre-step; maintain an overlay YAML |
| 2 | **`{*}` wildcard paths** — Fastify-specific, not standard OpenAPI, breaks Swift codegen | High | Preprocess spec with `jq` to rename `{*}` to `{objectPath}` before generation |
| 3 | **Schema names (`def-0`, `def-1`, `def-2`)** — autogenerated, not human-readable | Medium | Overlay or jq preprocessing to rename; or override model name in mustache template via `x-schema-name` |
| 4 | **Spec pinning** — `gh-pages` SHA must be manually bumped; no semver tag on the spec | Medium | Create a `specs/storage/openapi.json` committed copy in this repo; bump it via CI or manual PR |
| 5 | **No models-only mode** — generator always emits full transport stack | Low | Use `nonPublicApi=true` and wrap in a public facade; or use `--global-property=models` to emit only models (undocumented but works in some versions) |
| 6 | **Infrastructure layer ownership** — generated URLSession plumbing vs existing `supabase-swift` transport | Medium | Evaluate reusing existing `_Helpers` transport from `supabase-swift` instead of the generated `URLSessionImplementations.swift` |
| 7 | **Iceberg/Vector/S3 operations** — these are niche and inflate the generated surface | Low | Use path filter or tag filter at generation time; `--global-property=apis=Bucket,Object` |
| 8 | **`statusCode` is `String` not `Int`** in the error schema (Fastify quirk) | Low | Normalize in spec overlay; or handle in model template |

---

## 7. Temp Directory

All generated scratch output is at:

```
/var/folders/jr/ntdntr112251n_sc4mjrn1_80000gn/T/tmp.94vWtvLytn/
  storage-openapi.json   — fetched spec (76 KB)
  out/                   — full generator output (models + APIs + infra)
```

This directory is NOT committed to the repo. It will be cleaned by macOS on the next reboot.
