# CLAUDE.md -- @supabase/functions-typegen

## What This Package Does

Extracts the contracts of a Supabase project's Edge Functions into
`EdgeFunctionsMetadata`, a versioned, language-neutral JSON document. SDK
type generators (the Dart `supabase_typegen` package first) consume the
document to emit typed functions (a generated method per function). The package is meant to be
self-sufficient: an SDK generator runs it directly (through `npx`, `bunx` or
`deno run npm:`) without going through the Supabase CLI. A CLI command can
wrap it later, but nothing waits on that.

A function declares its contract by exporting `RequestBody` and
`ResponseBody` types from its entrypoint (`src/normalize.ts` holds the two
names). The names deliberately avoid the `Request` and `Response` globals.

## Architecture

- `src/discovery.ts` -- `discoverFunctions({ projectRoot })`. Mirrors the
  CLI's functions manifest: directories under `supabase/functions/` with an
  `index.ts`, merged with `[functions.<slug>]` in `config.toml`
  (`entrypoint`/`import_map` relative to `supabase/`, `verify_jwt`,
  `enabled`). Disabled functions are dropped. Paths in the result are
  project-relative POSIX paths.
- `src/deno.ts` -- the `DenoRunner` seam. `createSpawnDenoRunner(spawn,
  { command })` wraps any process runner whose request/result shapes match
  `@supabase/typegen`'s `Host.spawn` (declared structurally here, no
  dependency on the registry); `createLocalDenoRunner` is that runner over
  `node:child_process`. Requests carry `args` relative to `projectRoot`, and
  every command runs from the project root, so the registry's "spawn in
  `host.cwd`" rule holds. Planned next: a managed runner that downloads a
  pinned, checksum-verified Deno release, and a `bin` command (SDK-1967).
- `src/extract.ts` -- the producer. One `deno --version` probe first: when
  it fails, every function is listed without a contract and one
  project-level diagnostic (empty `slug`) explains why; nothing throws. Per
  function: `deno doc --json --private --no-lock --no-config` from the
  project root with `--import-map <path>` when the function has one (a
  `deno.json` is a valid import map, and `--import-map` works from any
  directory where `--config` did not); then follows `file:` imports that
  contract types reference until every referenced project module is
  documented; then normalizes. A function whose `deno doc` fails stays in
  the result with `null` bodies and a diagnostic.
- `src/normalize.ts` -- `deno doc` nodes to `ContractType`. Roots are
  inlined; every other named type becomes a declaration in `types`,
  referenced by name (so recursion works). Generics are instantiated
  inline. Anything JSON cannot carry becomes `unsupported` plus a
  diagnostic at a dotted path (`RequestBody.address.zip`).
- `src/doc-nodes.ts` -- the subset of the `deno doc --json` (document
  version 2) shape that is read. Every type node is `{ kind, value, repr? }`.
- `src/types.ts` -- the ArkType schemas and the `parse*`/`serialize*`
  boundary. ArkType cannot emit JSON Schema for the recursive type node, so
  unlike postgrest-typegen there is no `*JsonSchema` export.
- `src/sort.ts` -- `sortEdgeFunctionsMetadata`, applied by the producer.
  Functions by slug, declarations by name, diagnostics by slug/path/message,
  with the pinned English collation from `src/collation.ts`. Property, tuple
  and union order is source order and is kept.

## Commands

```bash
bun run build            # tsc --project tsconfig.build.json (emits dist/)
bun run check-types      # tsc --noEmit
bun run check-types:consumer # tsc --project tsconfig.consumer.json, the types a bundler sees
bun run test             # bun:test; needs `deno` on PATH
bun run format-and-lint  # oxfmt + oxlint check
bun run knip             # unused-code/deps check
bun run update-expected  # regenerate test/fixtures/expected/project.json
```

## Test Patterns

- `test/normalize.test.ts`: hand-built `deno doc` nodes, no Deno needed;
  the place for every conversion rule.
- `test/discovery.test.ts`: the fixture project plus temporary directories.
- `test/extract.test.ts`: real `deno doc` on `test/fixtures/project/`,
  compared with `test/fixtures/expected/project.json`. Regenerate the
  expected file on intentional output changes and review the diff in the
  PR: every change is a change every consumer sees. The `broken` function's
  diagnostic carries Deno's wording and an absolute path, so it is checked
  loosely and kept out of the fixture.
- Fixtures avoid `npm:`/`jsr:` imports so the suite runs offline.

## Non-goals

- Reading contracts out of `z.infer<typeof schema>` or other checker-derived
  types. `deno doc` is a parser, not a type checker; a checker-backed
  extractor is a possible later upgrade behind the same document.
- Following types into npm, JSR or remote modules.
- Generating any language. Generators live in the SDK repos and consume the
  JSON.
