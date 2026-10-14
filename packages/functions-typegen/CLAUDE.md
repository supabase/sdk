# CLAUDE.md -- @supabase/functions-typegen

## What This Package Does

Produces the optional `edgeFunctions` collection of
`@supabase/postgrest-typegen`'s `GeneratorMetadata`: the request and response
contracts of a Supabase project's Edge Functions, read from the project's
source files. SDK type generators (the Dart `supabase_typegen` package first)
consume the document to emit a typed method per function. The contract's
types, schemas, validation, JSON Schema and `sortEdgeFunctions` live in
postgrest-typegen; this package only reads projects and fills the shape.
`@supabase/postgrest-typegen` is a regular dependency with a published
range, and `overrides` in `package.json` pins it to `file:../postgrest-typegen`
so this repository installs and tests against the in-tree sibling, never a
published version. Consumers ignore the override. bun copies the sibling
directory into `node_modules`, so build postgrest-typegen before
`bun install` here, as the workflows do.

A function declares its contract by exporting `RequestBody` and
`ResponseBody` types from its entrypoint (`src/normalize.ts` holds the two
names). The names deliberately avoid the `Request` and `Response` globals.
Explicit opt-in per function: nothing is inferred from handler code.

## Architecture

- `src/discovery.ts` -- `discoverFunctions({ projectRoot })`. Mirrors the
  CLI's functions manifest: directories under `supabase/functions/` with an
  `index.ts`, merged with `[functions.<slug>]` in `config.toml`
  (`entrypoint`/`import_map` relative to `supabase/`, `verify_jwt`,
  `enabled`); import map lookup `deno.json`, `deno.jsonc`, the deprecated
  `import_map.json` next to the entrypoint, then the shared
  `supabase/functions/import_map.json`. Disabled functions are dropped.
  Paths in the result are project-relative POSIX paths. Only an ENOENT on
  the functions directory means "no functions"; other errors propagate.
- `src/parse.ts` -- `parseModule({ url, source, resolve })`. Reads one module
  with `@babel/parser` (`errorRecovery` on; a fatal error is caught into
  `parseErrors`) into the `ModuleModel` of `src/module-model.ts`: imports,
  re-exports, star re-exports, declarations and every type expression, with
  names resolved to the declaration, import or type parameter they refer
  to. An export list entry naming an import becomes a re-export. Babel 8
  AST specifics: `typeArguments`, `TSInterfaceHeritage`, enum
  `body.members`, parenthesized types dropped. The normalizer consumes the
  model only, so the parser can change without touching the type language.
- `src/resolve.ts` -- `parseImportMap` (JSON with comments) and
  `createSpecifierResolver`: relative specifiers, import map `imports` and
  `scopes`, the extension fallbacks Deno and TypeScript accept (`.ts`,
  `.tsx`, `.d.ts`, `.mts`, `.js` to `.ts`, `/index.ts`). `npm:`, `jsr:` and
  remote specifiers are returned as they are; an unresolved local path is
  `null`.
- `src/normalize.ts` -- `normalizeContract({ entrypointUrl, modules })`.
  Module models to `ContractType`. Roots are inlined (even when reached
  through a re-export); every other named declaration becomes an entry in
  `types`, referenced by name, so recursion and sharing work. Generics are
  instantiated inline with a guard against recursive instantiation. Anything
  JSON cannot carry becomes `unsupported` plus a diagnostic at a dotted path
  (`RequestBody.address.zip`). Diagnostics are `{ path, message }`, deduped.
- `src/extract.ts` -- the producer. `extractEdgeFunctions({ projectRoot,
  functions? })` discovers, loads modules lazily through a per-function
  `ModuleLoader`, normalizes, and returns `sortEdgeFunctions(...)` from
  postgrest-typegen. A missing entrypoint, an unreadable import map or a
  syntax error is a diagnostic on that function, never an exception.
- `src/collation.ts` -- the pinned English `compareStrings`, the same rule
  postgrest-typegen uses, for the one ordering done here (discovery).

Nothing executes user code and nothing touches the network. Deno is not
involved: `deno doc` was only ever a parser with module resolution, and the
`typescript` 7 package ships no JavaScript compiler API, which is why Babel.

## Commands

```bash
bun run build                # tsc --project tsconfig.build.json (emits dist/)
bun run check-types          # tsc --noEmit
bun run check-types:consumer # tsc --project tsconfig.consumer.json, the types a bundler sees
bun run test                 # bun:test; no Docker, no Deno, no network
bun run format-and-lint      # oxfmt + oxlint check
bun run knip                 # unused-code/deps check
bun run update-expected      # regenerate test/fixtures/expected/project.json
```

## Test Patterns

- `test/parse.test.ts` and `test/resolve.test.ts`: the parser and the
  resolver on real snippets and temporary directories.
- `test/normalize.test.ts`: every conversion rule on hand-built module
  models.
- `test/discovery.test.ts`: the fixture project plus temporary directories
  for the defaulting rules.
- `test/extract.test.ts`: the whole pipeline over `test/fixtures/project/`,
  compared with `test/fixtures/expected/project.json`. Regenerate the
  expected file on intentional output changes and review the diff in the
  PR: every change is a change every consumer sees. Temporary projects
  cover the failure paths.
- Discovery treats any `supabase/functions/<dir>/index.ts` as a function
  (the CLI does too), so a shared barrel in a fixture must not be named
  `index.ts`.
- Fixtures avoid `npm:`/`jsr:` imports so the suite runs offline.

## Non-goals

- Reading contracts out of `z.infer<typeof schema>` or other checker-derived
  types. A parser is not a type checker; a checker-backed extractor is a
  possible later upgrade behind the same document.
- Following types into npm, JSR or remote modules.
- Generating any language. Generators live in the SDK repos and consume the
  JSON.
