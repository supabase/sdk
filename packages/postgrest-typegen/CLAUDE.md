# CLAUDE.md -- @supabase/postgrest-typegen

## What This Package Does

Type generation for PostgREST from a PostgreSQL schema. Introspects a database
into a normalized `GeneratorMetadata` shape, then renders language types
(TypeScript, Go, Python, Swift) from it. This is the engine extracted from
postgres-meta (the one behind `supabase gen types`), repackaged as a small,
driver-agnostic library.

**IMPORTANT — scope, read before adding a language here.** Introspection and
the `GeneratorMetadata`/JSON contract are this package's permanent job. The
four bundled generators (TypeScript/Go/Python/Swift) are a **deliberate
transition**, not the pattern for new languages: they exist to let
`supabase gen types` keep working unchanged while postgres-meta's own copies
of these templates get deprecated in favor of this package (see SDK-1617).
**A new language's generator does NOT belong in this package** — it lives in
that language's own SDK repo, consuming `introspect()`'s JSON output via
`serializeGeneratorMetadata`/`generatorMetadataJsonSchema` (see the Dart
`supabase_typegen` package in `supabase/supabase-flutter` for the pattern).
Whether the four transitional generators eventually move out too is an open
question tracked in SDK-1641, not decided.

## Architecture

Hard split between **introspection** and **generation**:

- `src/introspection/` -- `introspect(db, opts) => GeneratorMetadata`. Takes a
  structural `Queryable` (`pg.Pool`/`pg.Client` satisfy it; postgres-meta
  injects its forked-pg pool). Runs SQL builders ported from postgres-meta.
- `src/generation/` -- `generateTypescript` / `generateGo` / `generatePython` /
  `generateSwift`. Pure functions: `GeneratorMetadata` in, source string out.
  No database access.
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
bun run build           # tsc --project tsconfig.build.json (emits dist/)
bun run check-types     # tsc --noEmit
bun run test            # bun:test (Docker required for integration/parity tests)
bun run format-and-lint # oxfmt + oxlint check
bun run knip            # unused-code/deps check
```

## Byte-Parity Constraint

This package must produce **byte-identical** output to postgres-meta's
templates until parity is validated and released. Two consequences:

- `prettier` is pinned **exact** to the version postgres-meta's own lockfile
  currently resolves (not a caret range, and not just "latest"), since a
  version mismatch reformats generator output and silently breaks parity with
  the real upstream CLI, not just with this package's own snapshots. Check
  postgres-meta's resolved version before bumping. Bumping means regenerating
  every inline snapshot (`bun test --update-snapshots`) and the parity
  fixtures under `test/parity/expected/`, and reviewing the diff.
- Don't "improve" template strings or SQL for existing generators without
  regenerating snapshots/fixtures first. Byte parity first; behavior-changing
  cleanups (e.g. oxfmt instead of prettier) come later.

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
replicates the sorts `generateTypescript` used to apply internally, so all four
generators now consume the single pass and TypeScript output stays
byte-identical. The only sorts that remain inside generators are ones the
single-collection pass cannot express: cross-collection *merge* sorts
(TypeScript and Swift merge tables + foreign tables, and views + materialized
views, into one per-schema group then sort by name) and TypeScript's
overload-resolution sorts. Don't reintroduce per-collection sorting in a
generator — extend `sortGeneratorMetadata` instead.

## Test Patterns

- Generation unit tests: pure, no Docker, fixture-builder + per-language inline
  snapshots (`src/` and `test/generation/`).
- Introspection/parity tests: `bun:test` + testcontainers PostgreSQL.
