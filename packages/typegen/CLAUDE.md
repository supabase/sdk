# CLAUDE.md -- @supabase/typegen

## What This Package Does

The language registry for `supabase gen types --lang <language>`. It exports
`languages`, a list of `TypegenLanguage` entries mapping a `--lang` name to the
generator that renders it, so new languages need a pull request here and a
dependency bump in the CLI, never CLI code. See SDK-1955 for the decision and
SDK-1956 for the CLI adapter that replaces the CLI's hardcoded switch.

Introspection is NOT here: the consumer calls `introspect()` from
`@supabase/postgrest-typegen` and passes the `GeneratorMetadata` in. The
registry sits above `postgrest-typegen` and the future per-SDK generator
packages (SDK-1641) to avoid a dependency cycle once TypeScript's generator
lives in supabase-js.

## Architecture

- `src/contract.ts` -- the public contract with the CLI: `Host` (cwd, env,
  signal, `spawn`, optional `format`), `OptionSpec`/`OptionValues`,
  `TypegenLanguage`. Changing these is a semver-relevant change for the CLI.
- `src/errors.ts` -- `TypegenError` and its subclasses (`InvalidOptionError`,
  `ToolNotInstalledError`, `ToolFailedError`, `MetadataRejectedError`). The
  CLI maps these to its actionability model generically; keep the fields
  stable.
- `src/options.ts` -- `resolveOptions`: defaults plus validation, run at the
  start of every `generate`.
- `src/languages/in-process.ts` -- `inProcessLanguage`: wraps a generator
  function; sorts the metadata first.
- `src/languages/external.ts` -- `externalLanguage`: runs a command in the
  host's `cwd` with `serializeGeneratorMetadata(sortGeneratorMetadata(m))` on
  stdin, returns stdout, classifies failures through the entry's `classify`.
- `src/languages/dart.ts` -- the first out-of-process entry:
  `dart run supabase_typegen --output - --schema <schemas>`.
- `src/languages/index.ts` -- the four in-process entries and the `languages`
  list. `typescript` exposes `postgrest-v9-compat` (inverse of
  `detectOneToOneRelationships`) and honors `host.format`; `swift` exposes
  `swift-access-control` limited to `internal|public` like the CLI always did.
- `src/node-host.ts` -- `createNodeHost`, a `Host` on `node:child_process`.

## Invariants

- Option `name`s are the CLI flag names verbatim. Existing users must see no
  change in flags.
- `generate` always sorts before generating and returns complete file
  contents for every language. In-process entries append the final newline
  the CLI has always emitted (pg-meta's `console.log`); out-of-process
  entries return the tool's stdout verbatim. The CLI writes the result as-is.
- In-process TypeScript formats through `host.format` when given. The CLI
  passes identity to keep `oxfmt` out of its bundle and its output unchanged.
- Out-of-process tools: stdout is code, stderr is diagnostics, exit 0 is
  success. `dart run` keeps stdout clean when it is not a terminal.
- `inProcess` must be accurate: hosted consumers (postgres-meta) filter on it.
- Keep the dependency list minimal; everything here lands in the CLI bundle.

## Commands

```bash
bun run test            # bun:test with a fake host; the node-host test spawns a shell script
bun run check-types
bun run format-and-lint
bun run knip
bun run build           # tsc --project tsconfig.build.json, emits dist/
```

## Tests

`test/fixtures.ts` holds a deliberately unsorted `GeneratorMetadata` validated
with `parseGeneratorMetadata`. `test/in-process.test.ts` asserts each bundled
language's output equals the direct generator call on sorted input (the
byte-identity acceptance criterion, without Docker). `test/dart.test.ts`
covers the handoff and every error classification with the fake host from
`test/helpers.ts`; `test/node-host.test.ts` runs a fake `dart` shell script
on PATH.
