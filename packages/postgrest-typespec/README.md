# postgrest-typespec

A [TypeSpec](https://typespec.io) model of the PostgREST v16 HTTP API, following the [API reference](https://docs.postgrest.org/en/v16/references/api.html).

The model is generic. It describes what every PostgREST server exposes, whatever database sits behind it. It does not describe one schema's tables, columns, or functions. For that, PostgREST serves its own schema-specific OpenAPI document at `/`, and `packages/postgrest-typegen` generates types.

## What is modeled

| Area | Where |
| --- | --- |
| `/{relation}`: tables and views (GET, HEAD, POST, PUT, PATCH, DELETE) | `src/relations.tsp` |
| `/rpc/{function}`: functions (GET, HEAD, POST) | `src/functions.tsp` |
| `/`: the generated OpenAPI document (GET, HEAD) | `src/root.tsp` |
| URL grammar: `select`, `order`, filters, logical operators, operators, aggregates, embedding hints | `src/grammar.tsp`, `src/parameters.tsp` |
| `Prefer` preferences, per operation | `src/preferences.tsp` |
| Range, profile, and response headers | `src/headers.tsp` |
| Content negotiation (`Accept`, request and response media types) | `src/representations.tsp`, `src/functions.tsp` |
| Error body, `PGRST` codes, status codes | `src/errors.tsp` |

Schema-dependent parts are opaque:

- A row is `Record<unknown>`.
- Table, view, and function names are a `ResourceName` path parameter.
- Column filters and embedded resource parameters (`age=gte.18`, `actors.order=last_name`) go in one exploded query object, `filters`. Its keys are column or embedding paths, and its values follow `FilterExpression`.
- For a GET function call, `arguments` holds the function arguments and the filters together, because PostgREST tells them apart by name only.

The query grammar is a set of documented string scalars (`SelectList`, `OrderList`, `FilterExpression`, `LogicalExpression`). The vocabulary inside the grammar is a set of enums (`FilterOperator`, `OperatorModifier`, `IsValue`, `AggregateFunction`, `EmbeddingJoinType`, and others). The OpenAPI output keeps these enums even though no operation refers to them, so generators can use them.

## Limits

- TypeSpec has no OPTIONS verb, so the model leaves out `OPTIONS` (the allowed methods and CORS preflight).
- The model declares one request body media type per operation variant and shares the route (`@sharedRoute`). The OpenAPI output merges the variants into one operation with several request content types.
- A filter key or a variadic argument can repeat (`age=gte.18&age=lte.65`, `v=1&v=2`). A string-valued record cannot show this, so only the documentation mentions it.

## Example client

`clients/js` is a TypeScript client emitted by [`@typespec/http-client-js`](https://www.npmjs.com/package/@typespec/http-client-js). It is an example of what a generator can build from the model, not a supported SDK.

```ts
import { PostgRestClient } from "./clients/js/src/index.js";

const client = new PostgRestClient(
  { getBearerToken: async () => jwt },
  { endpoint: "http://localhost:3000", allowInsecureConnection: true },
);

const films = await client.relationsClient.read("films", {
  select: "title,director:directors(name)",
  filters: { year: "gte.1990" },
  order: "year.desc",
  prefer: ["count=exact"],
});
```

The emitter (0.16.3) has gaps that shaped the model or that the tests work around:

- It puts property names, not wire names, into the URI template variables. Properties whose wire name differs are therefore named after the wire name (`` `not.or` ``, `on_conflict`). The function path parameter is `functionName`, since the emitter renames `function`.
- It mistypes the transforms of a union whose variants are unions, so the per-operation `Prefer` unions are aliases.
- It sends `application/x-www-form-urlencoded` bodies as JSON, and it matches response media types by substring (`for="application/json"` in a plan media type matches JSON). The e2e tests check these cases with plain `fetch`.
- It always sends a bearer token, so it cannot make anonymous requests without a JWT. Use a JWT whose `role` is the anonymous role.
- It warns `unknown-encoding` for raw `bytes` bodies. The warning is harmless: the bodies are sent and read as raw bytes.
- `@typespec/http-client-js` 0.16.3 and `@typespec/emitter-framework` 0.21.0 ask for different `@alloy-js` versions. The `overrides` in `package.json` pin one version so that the emitter loads.

## End-to-end tests

`e2e/` runs the example client against a real PostgREST v16 server. `docker-compose.yml` starts PostgreSQL and PostgREST on port 3901, and `fixture.sql` creates a small schema that covers tables, a view, embedding, schemas, privileges and function kinds.

```bash
bun run e2e:up     # start PostgreSQL and PostgREST (Docker)
bun run e2e        # run the tests (POSTGREST_URL overrides the server URL)
bun run e2e:down   # stop and remove the containers
```

## Commands

```bash
bun install
bun run build          # tsp compile → openapi/openapi.yaml and clients/js
bun run format         # tsp format
bun run format:check
bun run check-types    # type check the e2e tests and the emitted client
```

The generated `openapi/openapi.yaml` and `clients/js` are committed. CI fails when they do not match the TypeSpec sources, so run `bun run build` after every change. CI also runs the e2e tests.
