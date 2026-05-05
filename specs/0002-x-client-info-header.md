# Supabase Client Libraries — X-Client-Info Structured Header

| Field      | Value                                               |
| ---------- | --------------------------------------------------- |
| Version    | 0.2.2                                               |
| Status     | Draft                                               |
| Date       | 2026-04-28                                          |
| Authors    | Supabase SDK Team                                   |
| References | [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) |

---

## Abstract

This specification defines the structure and content of the `X-Client-Info` HTTP request header automatically sent by all Supabase client libraries. It covers the required format, the set of defined parameters, and the rules governing which parameters are included. Implementations that conform to this specification allow backend systems and analytics pipelines to reliably parse client identity, platform, and runtime information from a single header without requiring CORS allowlist changes when new fields are added.

---

## Definitions

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Term | Meaning |
| ---- | ------- |
| **client library** | A Supabase SDK that makes HTTP requests on behalf of an application (e.g. supabase-js, supabase-swift, supabase-py). |
| **sub-client** | A constituent library shipped inside or alongside a client library that makes its own HTTP requests (e.g. auth-js, postgrest-js). |
| **library token** | The `name/version` string that identifies the client library or sub-client. |
| **parameter** | A `key=value` pair appended to the header value after the library token. |
| **platform** | The operating system or host environment in which the client library runs (e.g. `iOS`, `macOS`, `Android`, `Linux`). |
| **runtime** | The language runtime or execution environment in which the client library executes (e.g. `swift`, `node`, `python`). |
| **framework** | An application framework detected in the host environment that wraps or extends the runtime (e.g. `next`, `flutter`, `expo`). |

---

## Requirements

### R1 — Header presence

**R1.1** Every HTTP request made by a client library MUST include an `X-Client-Info` header.

**R1.2** A sub-client that is initialized through a parent client library MUST inherit the `X-Client-Info` value set by the parent rather than replacing it with its own library token.

**R1.3** A sub-client used standalone (not via a parent client library) MUST send its own `X-Client-Info` header using the format defined in R2.

### R2 — Header format

**R2.1** The header value MUST begin with a library token of the form `name/version`, where `name` is the lowercase hyphenated library name and `version` is a [semver](https://semver.org) string.

**R2.2** When parameters are present, each MUST be separated from the preceding token or parameter by the two-character sequence `; ` (semicolon followed by a single space).

**R2.3** Each parameter MUST be of the form `key=value`, where `key` is a lowercase hyphenated ASCII string and `value` is a string containing no semicolons.

**R2.4** The complete header value MUST match the following grammar (ABNF):

```
x-client-info = library-token *( "; " parameter )
library-token = name "/" version
name          = 1*( ALPHA / DIGIT / "-" )
version       = 1*( DIGIT / "." / "-" / ALPHA )
parameter     = key "=" value
key           = 1*( ALPHA / DIGIT / "-" )
value         = *( %x20-3A / %x3C-7E )   ; printable ASCII except ";"
```

**R2.5** Parameters MAY appear in any order after the library token.

**Example** (Swift client on iOS):

```
X-Client-Info: supabase-swift/2.45.0; platform=iOS; platform-version=18.5.0; runtime=swift; runtime-version=6.0
```

### R3 — Defined parameters

**R3.1** A client library SHOULD include a `platform` parameter whose value identifies the host operating system or environment. Defined values are:

| Value | Environment |
| ----- | ----------- |
| `iOS` | Apple iOS (native) |
| `iOSAppOnMac` | iOS app running on macOS via Mac Catalyst compatibility mode |
| `macOS` | Apple macOS |
| `macCatalyst` | Mac Catalyst |
| `visionOS` | Apple visionOS |
| `watchOS` | Apple watchOS |
| `tvOS` | Apple tvOS |
| `Android` | Android |
| `Linux` | Linux |
| `Windows` | Windows |
| `browser` | Web browser (JS environments) |
| `edge-runtime` | Supabase Edge Functions / Deno Deploy runtime |

A client library MAY use a value not in this table if none of the above apply, but SHOULD use the closest matching value from the table where possible.

**R3.2** A client library SHOULD include a `platform-version` parameter whose value is the version string of the platform identified by `platform`. The format SHOULD follow the convention of the host platform (e.g. `18.5.0` for iOS 18.5, `15.2` for macOS 15.2).

**R3.3** A client library SHOULD include a `runtime` parameter whose value identifies the language runtime. Defined values are:

| Value | Runtime |
| ----- | ------- |
| `swift` | Swift |
| `kotlin` | Kotlin / JVM |
| `node` | Node.js |
| `deno` | Deno |
| `bun` | Bun |
| `python` | Python |
| `dart` | Dart |

**R3.4** A client library SHOULD include a `runtime-version` parameter whose value is the version string of the runtime identified by `runtime` (e.g. `6.0` for Swift 6.0, `20.10.0` for Node.js 20.10.0).

**R3.5** A client library SHOULD include a `framework` parameter when the application is built with a detectable application framework. Defined values are:

| Value | Framework |
| ----- | --------- |
| `next` | Next.js |
| `nuxt` | Nuxt |
| `sveltekit` | SvelteKit |
| `remix` | Remix |
| `astro` | Astro |
| `expo` | Expo (React Native) |
| `react-native` | React Native (without Expo) |
| `flutter` | Flutter |
| `electron` | Electron |

A client library MAY use a value not in this table when the framework is detectable but not listed above.

**R3.6** A client library SHOULD include a `framework-version` parameter whose value is the version string of the framework identified by `framework` (e.g. `15.1.0` for Next.js 15.1.0).

**R3.7** A parameter MUST be omitted entirely when its value cannot be determined at compile time or runtime. A client library MUST NOT use an empty string or a placeholder such as `unknown` as a parameter value.

### R4 — User-supplied headers

**R4.1** If an application provides a custom value for `X-Client-Info`, the client library MUST use the application-supplied value and MUST NOT append or prepend its own library token or parameters.

---

## Scenarios

### Format

#### `well-formed-header`
A client library emits the header on a normal request.

**Stimulus**: Application initializes client; client makes any HTTP request.
**Expected**: Request contains exactly one `X-Client-Info` header. Value begins with `name/semver`. All present parameters follow the library token, are `; `-separated, and are in `key=value` form with no semicolons in any value.

#### `no-duplicate-header`
Exactly one `X-Client-Info` header is present on every request.

**Stimulus**: Client makes any HTTP request.
**Expected**: Exactly one `X-Client-Info` header field is present on the request; no duplicate header names.

### Inheritance

#### `standalone-sub-client`
Auth sub-client used without a parent Supabase client.

**Stimulus**: Application creates an `AuthClient` (or language equivalent) directly; the auth client makes an HTTP request.
**Expected**: The request contains `X-Client-Info` whose library token is the auth sub-client's own name and version (e.g. `auth-js/2.0.0`). No parent library token is present.

#### `parent-overrides-sub-client`
Auth sub-client initialized via parent SupabaseClient.

**Stimulus**: Application creates a `SupabaseClient`; the resulting auth client makes a request.
**Expected**: The request carries the parent's `X-Client-Info` value (e.g. `supabase-swift/2.45.0; ...`), not the sub-client's own library token.

#### `user-supplied-header`
Application provides a custom `X-Client-Info` value.

**Stimulus**: Application initializes client with `headers: { "X-Client-Info": "my-app/1.0.0" }`; client makes a request.
**Expected**: Request contains `X-Client-Info: my-app/1.0.0`. The library does not modify or append to the value.

### Parameters

#### `platform-included`
Client library on a known platform includes the platform parameter.

**Stimulus**: supabase-swift initializes and makes a request on an iOS device.
**Expected**: `X-Client-Info` includes `platform=iOS`.

#### `missing-platform-version`
Platform is known but its version cannot be determined.

**Stimulus**: Client runs in an environment where the OS version is not accessible.
**Expected**: `X-Client-Info` includes a `platform` parameter whose value is drawn from the defined table in R3.1 (e.g. `platform=Linux`) and omits `platform-version` entirely. No empty or placeholder value appears.

#### `runtime-included`
Client library on a known runtime includes runtime and runtime-version parameters.

**Stimulus**: supabase-swift initializes on a device compiled with Swift 6.0 and makes a request.
**Expected**: `X-Client-Info` includes `runtime=swift` and `runtime-version=6.0`.

### Framework

#### `framework-detected`
Client library running inside a detectable framework includes framework parameters.

**Stimulus**: supabase-js is used inside a Next.js 15.1.0 application; client makes a request.
**Expected**: `X-Client-Info` includes `framework=next` and `framework-version=15.1.0` (the version string resolved from the application's dependency manifest).

#### `framework-not-detectable`
Client library cannot determine which framework is in use.

**Stimulus**: supabase-js is used in a plain Node.js script with no framework present.
**Expected**: `X-Client-Info` omits both `framework` and `framework-version` entirely.

---

## Rationale

**Why a single structured header instead of multiple headers?** Adding a new HTTP header to a client library is a breaking change for applications that run the JS client inside Supabase Edge Functions. Users must enumerate allowed CORS headers explicitly; any header not in the allowlist is blocked. The `X-Client-Info` header is already present in every existing CORS allowlist, so encoding all metadata as parameters of that single header allows new fields to be added freely without requiring application changes.

**Why semicolon-delimited `key=value` parameters?** This is the convention used by the `Content-Type` header (e.g. `application/json; charset=utf-8`). It is trivially parseable — split on `; `, treat the first segment as `name/version`, treat the rest as `key=value` pairs — and is already well-understood by HTTP tooling and log processors.

**Why SHOULD rather than MUST for platform, runtime, and their versions?** Not all runtime environments expose platform or runtime version information through a public API. Mandating these parameters would require implementations to ship placeholder values or stub strings, which is worse for analytics than omitting the parameter entirely. `SHOULD` permits omission when the information is genuinely unavailable while making the intent clear.

**Why MUST omit rather than use a placeholder when a value is unknown?** An empty string or `unknown` value reaches analytics pipelines and distorts aggregations (e.g. an `unknown` iOS version would appear as a distinct platform version rather than a missing data point). Omitting the parameter entirely is unambiguous: its absence signals unavailability.

**Why is parameter order not mandated?** Client libraries are implemented independently across many languages and execution environments. Enforcing a fixed order would require coordinated changes whenever a new parameter is introduced and would make conformance harder to verify. Data pipeline parsers that consume this header are expected to locate parameters by key, not by position; that responsibility is outside the scope of this spec.

**Why SHOULD for the closest table value when using an unlisted platform?** Forcing an exact match to the defined table would break client libraries on emerging platforms before the spec can be updated. Permitting any value with a preference for the closest match balances forward-compatibility against analytics consistency.

**Why SHOULD for platform-version format following host convention?** Version string formats differ meaningfully across platforms (e.g. macOS uses `major.minor`, Linux kernel versions include a patch and build string). Mandating a single format would require normalization logic in every client library and could produce less useful values than the native format. Downstream parsers are better placed to normalize for aggregation.

**Why SHOULD for framework rather than MUST?** Framework detection is not universally possible. In server-side environments a library can inspect environment variables or `package.json` dependencies; in bundled or compiled outputs this information may not be available at runtime. `SHOULD` conveys that detection is expected where feasible without penalising environments where it is not.

---

## Changelog

| Version | Date       | Description   |
| ------- | ---------- | ------------- |
| 0.1.0   | 2026-04-28 | Initial draft |
| 0.2.0   | 2026-04-28 | R2.5: parameter order is not mandated. Added R3.5–R3.6 for `framework` and `framework-version`; former R3.5 (omission rule) renumbered to R3.7 |
| 0.2.1   | 2026-04-28 | Added `framework` to Definitions. Removed out-of-scope parser normative text from R2.5. Added rationale entries for R3.1 and R3.2 nested SHOULDs. Regrouped scenarios; fixed `standalone-sub-client` and `framework-detected` wording; added `platform-included` and `runtime-included` scenarios |
| 0.2.2   | 2026-04-28 | R2.2: clarified that separator requirement is conditional on parameters being present. `missing-platform-version` scenario: replaced `<value>` placeholder with concrete wording referencing R3.1 table |
