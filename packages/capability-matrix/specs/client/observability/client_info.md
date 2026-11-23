# Client Info Header

Every HTTP request an SDK sends to a Supabase service carries an `X-Client-Info`
header that identifies the SDK, its version and the environment it runs in, so
usage can be aggregated per SDK, version, platform, runtime and framework.

## Behavior

### Format

The value is a product token followed by zero or more parameters, each preceded
by `; ` (a semicolon and a space), following the same convention as the
`Content-Type` header:

```
X-Client-Info: name/version[; key=value ...]
```

For example:

```
X-Client-Info: supabase-example/1.4.0; platform=Android; platform-version=15; runtime=dart; runtime-version=3.10.0; framework=flutter; framework-version=3.38.0; features=typed-api
```

- `name` identifies the SDK in lowercase kebab-case and is the same for every
  release of the SDK.
- `version` is the version of the SDK release that sends the request, without a
  `v` prefix.
- Each parameter has a key containing only ASCII letters, digits, underscores or
  hyphens (`^[A-Za-z0-9_-]+$`), `=`, and a non-empty value. SDK-defined keys in
  the table below are lowercase. Keys are unique case-insensitively, and
  parameters can come in any order.
- A parameter whose value the SDK cannot determine is left out. The SDK never
  sends an empty value or a placeholder such as `unknown`.
- A value has no leading or trailing whitespace. Every character outside
  printable ASCII (0x20 to 0x7E), every `;` and every `%` is percent-encoded as
  its UTF-8 bytes, so `;` becomes `%3B`. Spaces are sent as they are.

### Parameters

| Parameter               | Value                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform`              | The operating system or host environment, using the names in [Platform names](#platform-names).                                                                                                                                               |
| `platform-version`      | The version of the platform, as the runtime reports it.                                                                                                                                                                                       |
| `platform-architecture` | The instruction set of the processor the platform runs on, physical or virtual, using Go's `GOARCH` names: `386`, `amd64`, `arm`, `arm64`, `loong64`, `mips`, `mips64`, `mips64le`, `mipsle`, `ppc64`, `ppc64le`, `riscv64`, `s390x`, `wasm`. |
| `runtime`               | The language runtime executing the SDK: `bun`, `dart`, `deno`, `dotnet`, `go`, `kotlin`, `node`, `python` or `swift`.                                                                                                                         |
| `runtime-version`       | The version of the runtime, as the runtime reports it, without a `v` prefix.                                                                                                                                                                  |
| `framework`             | The application framework, when the SDK can detect it: `electron`, `expo`, `flutter`, `next`, `nuxt`, `react-native`, `remix` or `sveltekit`.                                                                                                 |
| `framework-version`     | The version of the framework.                                                                                                                                                                                                                 |
| `features`              | The SDK features the request was built with, see [Features](#features).                                                                                                                                                                       |
| `via`                   | The library built on the SDK that sends the request, as `name/version` in the form of the product token, see [Library-supplied parameters](#library-supplied-parameters).                                                                     |
| `middleware`            | The middleware of that library the request passed through, see [Library-supplied parameters](#library-supplied-parameters).                                                                                                                   |

A value that is not listed for `runtime` or `framework` is added to this file
before an SDK sends it, so it can be aggregated across SDKs.

`runtime` names the language runtime, never the host or framework it runs in.
JavaScript in a web browser sends `platform=browser` and leaves out `runtime`
and `runtime-version`. JavaScript in React Native sends the device's platform,
such as `platform=iOS`, together with `framework=react-native`, and leaves out
`runtime` and `runtime-version`. JavaScript on Cloudflare Workers or the Vercel
Edge Runtime sends `platform=cloudflare-workers` or
`platform=vercel-edge-runtime` and leaves out `runtime` and `runtime-version`,
because the runtime there is not one of the values above. Supabase Edge Runtime
and Netlify Edge Functions run Deno, so they send `runtime=deno` together with
their platform.

### Platform names

A platform in this table is sent with the name and casing given here. Any other
platform is sent with the name the runtime reports for it, so it stays visible
in aggregates until it is added here.

| Platform                                                 | Name                  |
| -------------------------------------------------------- | --------------------- |
| Android                                                  | `Android`             |
| iOS and iPadOS                                           | `iOS`                 |
| macOS                                                    | `macOS`               |
| Linux                                                    | `Linux`               |
| Windows                                                  | `Windows`             |
| A web browser, including Web Workers and Service Workers | `browser`             |
| Supabase Edge Runtime                                    | `edge-runtime`        |
| Netlify Edge Functions                                   | `netlify-edge`        |
| Cloudflare Workers                                       | `cloudflare-workers`  |
| Vercel Edge Runtime                                      | `vercel-edge-runtime` |
| WebAssembly System Interface preview 1                   | `WASIp1`              |

### Application-supplied value

An `X-Client-Info` header the application sets through the client's global
headers, matched case-insensitively, replaces the SDK's value on every request,
including the parameters the SDK detects itself. The SDK still adds the
`features` parameter to that value, as described below.

### Library-supplied parameters

An SDK lets a library built on it supply custom key/value parameters when it
creates a client, so the library can identify itself without replacing the SDK's
value. Keys follow the syntax in [Format](#format). SDK-owned keys are reserved
case-insensitively, even when the SDK does not emit them in the current
environment: `platform`, `platform-version`, `platform-architecture`, `runtime`,
`runtime-version`, `framework`, `framework-version` and `features`. Other custom
keys are allowed; `via` and `middleware` are conventions shared by libraries.
This reservation applies only to the library-parameter option, not to existing
application-supplied header overrides.

- Each pair is appended as `; key=value`, in the order supplied, to the value in
  effect: the SDK's own, or the application-supplied one. The SDK trims the
  value and encodes it as described under [Format](#format).
- Omitted or empty library parameters leave existing behavior unchanged. The SDK
  encodes only newly appended values; it does not validate, trim or re-encode
  the existing header, and does not mutate application-owned options.
- Every request with non-empty library parameters carries one `X-Client-Info`
  header. The SDK removes an application-supplied header of another casing
  instead of sending both.

`via` is the library's own `name/version`, for example `example-lib/1.2.0`.

`middleware` lists the middleware the library applied to the request. The value
is a comma-separated list under a single key, with lowercase kebab-case tokens
(`[a-z0-9-]`), sorted alphabetically and without duplicates. The parameter is
left out when no middleware applies. Libraries may supply their own tokens.
Known tokens include:

| Token                      | Meaning                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oauth-protected-resource` | The client was created downstream of OAuth protected-resource middleware; this identifies composition, not proof of authentication or MCP traffic. |

### Features

The `features` parameter lists the SDK features used to build the request it is
sent with. It is set per request, not per client: a client that uses both the
typed and the untyped query API sends `typed-api` only on the requests built
with the typed API.

- The value is a comma-separated list under a single `features` key.
- Each feature is a lowercase kebab-case token (`[a-z0-9-]`), so the value never
  needs quoting or percent-encoding.
- The features are sorted alphabetically and contain no duplicates, so the same
  set always produces the same string.
- When the header value already has a `features` parameter, for example from an
  application-supplied value, the SDK merges both lists into one parameter and
  sorts the result.
- The parameter is left out when no feature applies.
- Only the values in the table below are sent. A new value is added to this
  table before an SDK ships it.

| Value       | Meaning                                                                                                                     | Applies to         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `typed-api` | The request was built with the type-safe API: a typed table query, a typed RPC call or the initial fetch of a typed stream. | PostgREST requests |

The value sent with a Realtime connection has no `features` parameter. The
connection is opened once, before most channels exist, so it cannot describe
what a channel uses.

### Other identification headers

An SDK sends no header other than `X-Client-Info` to identify itself or its
environment, and new metadata becomes a parameter of `X-Client-Info`. An Edge
Function called from a browser has to list every request header in its
`Access-Control-Allow-Headers` response, and the
[documented CORS setup](https://supabase.com/docs/guides/functions/cors) lists
`x-client-info`, so a new header would fail the preflight of every function
deployed with that setup.

The headers `X-Supabase-Client-Platform`, `X-Supabase-Client-Platform-Version`,
`X-Supabase-Client-Runtime` and `X-Supabase-Client-Runtime-Version` are not
sent. Their values are the `platform`, `platform-version`, `runtime` and
`runtime-version` parameters.

## Errors

The SDK raises its own argument error, when the client is created and before any
request, for a library-supplied parameter that:

- has a key that does not match `^[A-Za-z0-9_-]+$`
- has an SDK-owned reserved key, even when absent from the value in effect
- has a key already in the value in effect or another supplied entry, compared
  case-insensitively
- has a value that is not a string, or is empty after trimming

The gateway accepts an `X-Client-Info` header whatever it holds, so none of
these is ever rejected on the wire. They surface only as wrong data, since a
parameter is found by key and a repeated key leaves a consumer without a way to
pick one of its two values.

## Notes

A consumer of the header splits the value on `;` and trims each segment. The
first segment is the product token, split on its last `/` into name and version.
Each other segment is split on its first `=` into key and value, and the
`features` and `middleware` values are split on `,`. Percent-encoded values are
decoded as UTF-8 once, after separating parameters and list tokens. Parameters
are found by key case-insensitively, never by position. Consumers retain raw
metadata and tolerate unencoded legacy values. The full value is not a stable
client identifier, since `features` changes between requests from the same
client, so it is left out when counting clients.

## Related

- Global Request Headers (`client.request_configuration.global_headers`): an
  `X-Client-Info` header set there replaces the SDK's value.
