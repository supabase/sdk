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
- A filter key can repeat (`age=gte.18&age=lte.65`). A string-valued record cannot show this, so only the documentation mentions it.

## Commands

```bash
bun install
bun run build          # tsp compile → openapi/openapi.yaml
bun run format         # tsp format
bun run format:check
```

The generated `openapi/openapi.yaml` is committed. CI fails when it does not match the TypeSpec sources, so run `bun run build` after every change.
