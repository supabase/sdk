# CLAUDE.md -- @supabase/functions-typegen

## What This Package Does

Extracts the contracts of a Supabase project's Edge Functions into
`EdgeFunctionsMetadata`, a versioned, language-neutral JSON document. SDK
type generators (the Dart `supabase_typegen` package first) consume the
document to emit typed function descriptors; the Supabase CLI is the
intended host that runs the extraction.

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
- `src/deno.ts` -- the `DenoRunner` seam. `createLocalDenoRunner` runs the
  host binary; the CLI supplies a container-backed runner. Requests carry
  `cwd` relative to `projectRoot` and args relative to `cwd`, so a runner
  never has to translate host paths.
- `src/extract.ts` -- the producer. Per function: `deno doc --json --private
  --no-lock` from the entrypoint's directory with `--config` (deno.json) or
  `--import-map` (anything else) or `--no-config`; then follows `file:`
  imports that contract types reference until every referenced project
  module is documented; then normalizes. A function whose `deno doc` fails
  stays in the result with `null` bodies and a diagnostic.
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
