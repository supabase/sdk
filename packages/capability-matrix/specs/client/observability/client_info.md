# Client Info Header

Every HTTP request an SDK sends to a Supabase service carries an `X-Client-Info` header that identifies the SDK, its version and the environment it runs in, so usage can be aggregated per SDK, version, platform, runtime and framework.

## Behavior

### Format

The value is a product token followed by zero or more parameters, each preceded by `; ` (a semicolon and a space), following the same convention as the `Content-Type` header:

```
X-Client-Info: name/version[; key=value ...]
```

For example:

```
X-Client-Info: supabase-example/1.4.0; platform=Android; platform-version=15; runtime=dart; runtime-version=3.10.0; framework=flutter; framework-version=3.38.0; features=typed-api
```

- `name` identifies the SDK in lowercase kebab-case and is the same for every release of the SDK.
- `version` is the version of the SDK release that sends the request, without a `v` prefix.
- Each parameter is a lowercase key from the table below, `=`, and a non-empty value. A key appears at most once, and parameters can come in any order.
- A parameter whose value the SDK cannot determine is left out. The SDK never sends an empty value or a placeholder such as `unknown`.
- A value has no leading or trailing whitespace. Every character outside printable ASCII (0x20 to 0x7E), every `;` and every `%` is percent-encoded as its UTF-8 bytes, so `;` becomes `%3B`. Spaces are sent as they are.

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

A value that is not listed for `runtime` or `framework` is added to this file before an SDK sends it, so it can be aggregated across SDKs.

`runtime` names the language runtime, never the host or framework it runs in. JavaScript in a web browser sends `platform=browser` and leaves out `runtime` and `runtime-version`. JavaScript in React Native sends the device's platform, such as `platform=iOS`, together with `framework=react-native`, and leaves out `runtime` and `runtime-version`.

### Platform names

A platform in this table is sent with the name and casing given here. Any other platform is sent with the name the runtime reports for it, so it stays visible in aggregates until it is added here.

| Platform                               | Name           |
| -------------------------------------- | -------------- |
| Android                                | `Android`      |
| iOS and iPadOS                         | `iOS`          |
| macOS                                  | `macOS`        |
| Linux                                  | `Linux`        |
| Windows                                | `Windows`      |
| A web browser                          | `browser`      |
| Supabase Edge Runtime                  | `edge-runtime` |
| WebAssembly System Interface preview 1 | `WASIp1`       |

### Application-supplied value

An `X-Client-Info` header the application sets through the client's global headers, matched case-insensitively, replaces the SDK's value on every request. This lets a library built on top of the SDK identify itself. The SDK still adds the `features` parameter to that value, as described below.

### Features

The `features` parameter lists the SDK features used to build the request it is sent with. It is set per request, not per client: a client that uses both the typed and the untyped query API sends `typed-api` only on the requests built with the typed API.

- The value is a comma-separated list under a single `features` key.
- Each feature is a lowercase kebab-case token (`[a-z0-9-]`), so the value never needs quoting or percent-encoding.
- The features are sorted alphabetically and contain no duplicates, so the same set always produces the same string.
- When the header value already has a `features` parameter, for example from an application-supplied value, the SDK merges both lists into one parameter and sorts the result.
- The parameter is left out when no feature applies.
- Only the values in the table below are sent. A new value is added to this table before an SDK ships it.

| Value       | Meaning                                                                                                                     | Applies to         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `typed-api` | The request was built with the type-safe API: a typed table query, a typed RPC call or the initial fetch of a typed stream. | PostgREST requests |

The value sent with a Realtime connection has no `features` parameter. The connection is opened once, before most channels exist, so it cannot describe what a channel uses.

### Other identification headers

An SDK sends no header other than `X-Client-Info` to identify itself or its environment, and new metadata becomes a parameter of `X-Client-Info`. An Edge Function called from a browser has to list every request header in its `Access-Control-Allow-Headers` response, and the [documented CORS setup](https://supabase.com/docs/guides/functions/cors) lists `x-client-info`, so a new header would fail the preflight of every function deployed with that setup.

The headers `X-Supabase-Client-Platform`, `X-Supabase-Client-Platform-Version`, `X-Supabase-Client-Runtime` and `X-Supabase-Client-Runtime-Version` are not sent. Their values are the `platform`, `platform-version`, `runtime` and `runtime-version` parameters.

## Notes

A consumer of the header splits the value on `;` and trims each segment. The first segment is the product token, split on its last `/` into name and version. Each other segment is split on its first `=` into key and value, and the `features` value is split on `,`. Parameters are found by key, never by position. The full value is not a stable client identifier, since `features` changes between requests from the same client, so it is left out when counting clients.

## Related

- Global Request Headers (`client.request_configuration.global_headers`): an `X-Client-Info` header set there replaces the SDK's value.
