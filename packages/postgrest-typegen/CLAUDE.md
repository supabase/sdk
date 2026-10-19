# CLAUDE.md -- @supabase/postgrest-typegen

## What This Package Does

Type generation for PostgREST from a PostgreSQL schema. Introspects a database
into a normalized `GeneratorMetadata` shape, then renders language types
(TypeScript, Go, Python, Swift) from it. This is the engine extracted from
postgres-meta (the one behind `supabase gen types`), repackaged as a small,
driver-agnostic library.

**IMPORTANT — scope, read before adding a language here.** Introspection and
the `GeneratorMetadata`/JSON contract are this package's permanent job. The
three bundled generators (TypeScript/Go/Python) are a **deliberate
transition**, not the pattern for new languages: they move out one language
at a time, TypeScript first into supabase-js, then Go and Python.
**A new language's generator does NOT belong in this package** — it lives in
that language's own SDK repo, consuming `introspect()`'s JSON output via
`serializeGeneratorMetadata`/`generatorMetadataJsonSchema` (see the Dart
`supabase_typegen` package in `supabase/supabase-flutter` and the Swift
`supabase-typegen` executable in `supabase/supabase-swift` for the pattern).
`generateSwift` is the supabase-swift 2 generator, kept for projects on that
major while the executable serves supabase-swift 3 and later; it takes no new
features and goes once supabase-swift 2 is no longer supported.
The compatibility rule for the contract, how `GENERATOR_METADATA_VERSION`
relates to the package version and who reviews contract changes are in the
README under "Contract compatibility".

## Architecture

Hard split between **introspection** and **generation**:

- `src/introspection/` -- `introspect(db, opts) => GeneratorMetadata`. Takes a
  structural `Queryable` (`pg.Pool`/`pg.Client` satisfy it; postgres-meta
  injects its forked-pg pool). Runs the SQL builders in `src/introspection/sql/`.
  View column `is_nullable` is the one value computed outside SQL:
  `view-nullability.ts` parses each view's `pg_rewrite.ev_action` with
  `node-tree.ts` and walks its query tree (see "View column nullability" in the
  README). It reads only the join tree and range table, never
  `varnullingrels`, so one code path serves PostgreSQL 15 and later.
- `src/generation/` -- `generateTypescript` / `generateGo` / `generatePython` /
  `generateSwift`. Pure functions: `GeneratorMetadata` in, the complete source
  file (ending in a single newline) out. No database access.
- `src/rpc.ts` -- `resolveRpcFunctions(metadata) => RpcFunction[]`, the
  PostgREST view of the raw `functions` collection: which functions `/rpc`
  exposes, overload grouping and order, resolved parameter and return types,
  `setof_options` for embedding, `computed_field_of` and the per-overload
  `error` for unresolvable overloads. Pure and canonically ordered.
  `introspect()` attaches its result as `metadata.rpcFunctions` (optional in
  the contract); the TypeScript generator reads that collection and falls
  back to running the pass when a document lacks it. **All PostgREST function
  semantics live here**, so an out-of-process generator never reimplements
  them: a rule change is a change to this file plus the parity goldens, never
  to a generator.
- `src/types.ts` -- `GeneratorMetadata` + `Postgres*` types. This is the public,
  pluggable contract: any source that can produce `GeneratorMetadata` can feed
  the generators. **ArkType is the single source of truth here**: each shape is
  an ArkType schema and the exported type is `typeof schema.infer`. The arrays
  on `GeneratorMetadata` use `.omit("columns")` to mirror `Omit<…, "columns">`.
  A compile-time equivalence test (`test/validation/validate.test.ts`) pins the
  inferred types to the frozen interface contract so they can't silently drift.
  `parseGeneratorMetadata(data)` is an **opt-in** runtime validator (throws on
  mismatch) — it is intentionally NOT called inside `introspect()`; integrators
  with a custom producer wrap the result themselves. `GENERATOR_METADATA_VERSION`
  and `generatorMetadataSchema.version` let an out-of-process consumer detect a
  shape change; `generatorMetadataJsonSchema` and `serializeGeneratorMetadata`
  own the JSON boundary for generators living outside this process.

## Subpath Exports

- `.` -- everything
- `./introspection` -- `introspect`, `Queryable`
- `./generation` -- the `generateX` functions

The `bun` condition serves TypeScript source directly; `import`/`require` serve
compiled JS from `dist/`.

## Commands

```bash
bun run build                # tsc --project tsconfig.build.json (emits dist/)
bun run check-types          # tsc --noEmit
bun run check-types:consumer # tsc --project tsconfig.consumer.json
bun run test                 # bun:test (Docker required for integration/parity tests)
bun run format-and-lint      # oxfmt + oxlint check
bun run knip                 # unused-code/deps check
```

`check-types:consumer` compiles `src/` with `@tsconfig/bun` plus
`customConditions: ["bun"]`, which is how the Supabase CLI type-checks this
package: its `bun` exports condition hands the CLI `src/*.ts` rather than
`dist/*.d.ts`, so `src/` must also pass stricter flags such as
`noUncheckedIndexedAccess` that the package's own base config does not set.

## Consumers

postgres-meta's hosted `/generators/*` routes and the Supabase CLI's
`gen types` consume this package through `@supabase/typegen`
(`packages/typegen`), which pins an exact version. This package is the single
source of truth for generator output: there is no upstream to stay
byte-identical with, and no cross-check against postgres-meta, whose output is
whatever version its lockfile pins. Consequences:

- Every generator output change is a behavior change for every consumer.
  Regenerate the inline snapshots (`bun test --update-snapshots`) and the
  goldens under `test/parity/expected/` in the same PR, review that diff
  deliberately, and describe the output change in the PR so it reaches the
  release notes consumers read before bumping.
- Don't reformat or "clean up" template strings casually; a formatter-only
  change still churns every consumer's generated files.

SQL literal quoting: the introspection queries use `literal()` from
`src/introspection/sql/pg-format.ts`, an inlined port of `pg-format@1.0.4`
(the package has no `pg-format` runtime dependency: pg-format is CJS-only,
which is painful for ESM and bundled consumers such as the CLI). It keeps pg-format's
quirks — numbers are quoted (`literal(10)` is `'10'`) — so it stays a faithful
port even though the introspection only quotes schema names today. Don't align
it with `packages/pg-meta`'s variant in `supabase/supabase`, which emits
unquoted numbers.

`int8` columns: stock `pg` returns them as strings while postgres-meta installs
a global int8 type parser. `src/introspection/normalize.ts` coerces known
numeric id fields after each query so output is identical under any driver.

**Deterministic ordering:** the Go/Python/Swift generators emit objects in
`GeneratorMetadata` order (only TypeScript sorts internally), so output is
sensitive to however the producer ordered its collections. Do NOT rely on
introspection query order (heap/aggregate-plan order is environment- and
data-dependent — the parity test can pass locally while postgres-meta's
order-sensitive snapshots break in CI). Stability is enforced by a single
generator-agnostic pass, `sortGeneratorMetadata` (`src/sort.ts`): callers apply
it to the metadata *after* introspection and *before* any `generate*` call. The
generators document that they expect pre-sorted input; introspection queries
carry no `ORDER BY`. Sort keys are **semantic** (schema + name + signature),
never oid — equivalent databases assign different oids, so an oid sort would
still churn output across environments.

**TypeScript is the source of truth for ordering.** `sortGeneratorMetadata`
applies the sorts `generateTypescript` defines, and all four generators
consume that single pass. The only sorts that remain inside generators are ones the
single-collection pass cannot express: cross-collection *merge* sorts
(TypeScript and Swift merge tables + foreign tables, and views + materialized
views, into one per-schema group then sort by name). RPC overload order is
owned by `resolveRpcFunctions` (argument list, then return type) and kept by
`sortGeneratorMetadata`. Don't add per-collection sorting in a
generator — extend `sortGeneratorMetadata` instead.

## Test Patterns

- Generation unit tests: pure, no Docker, fixture-builder + per-language inline
  snapshots (`src/` and `test/generation/`).
- Introspection/parity tests: `bun:test` + testcontainers PostgreSQL.
