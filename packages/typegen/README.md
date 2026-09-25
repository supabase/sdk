# @supabase/typegen

The language registry behind `supabase gen types --lang <language>`. It maps
each language name to the generator that renders PostgREST types for it, so
that adding a language is a pull request in this repository plus a dependency
bump in the Supabase CLI, with no per-language code in the CLI itself.

> **Status:** alpha. The `Host`, `TypegenLanguage`, option and error types
> are the contract with the CLI and follow semver from `1.0.0` on; before that,
> minor versions may change them.

## Where it sits

```
Supabase CLI          connects to the database, introspects it with the
                      introspect() re-exported here, looks --lang up here
      |
@supabase/typegen     this package: language name to generator
      |
      +-- in-process entry      imports a generator function and calls it
      |                         with the GeneratorMetadata object
      |
      +-- out-of-process entry  runs the language's own tool in the user's
                                project with the GeneratorMetadata JSON
                                document on stdin, reads the code from stdout
```

Introspection is not part of this package's logic. The consumer runs
`introspect()` and hands the resulting `GeneratorMetadata` to the language it
looked up here. `introspect`, `Queryable`, `IntrospectOptions`,
`GeneratorMetadata` and `GENERATOR_METADATA_VERSION` are re-exported from
`@supabase/postgrest-typegen`, so a consumer depends on this package alone:
one dependency to bump, and the document is always produced by the same
`postgrest-typegen` version the in-process generators were built against.
That is why the dependency is pinned to an exact version rather than a
range; dependabot bumps it, and each bump is a registry release.
Depending on both packages directly would let a lockfile resolve two
versions, introspecting with one and generating with the other.

The two kinds of generator relate to `postgrest-typegen` differently:

- In-process generators import its types, so they depend on it. Today those
  are the four bundled inside `postgrest-typegen`; permanently it will be the
  TypeScript generator once it lives in supabase-js and is published to npm.
- Out-of-process generators depend on nothing here. They read the JSON
  document, whose shape is published as `generatorMetadataJsonSchema` and
  versioned by `GENERATOR_METADATA_VERSION`, and can be written in any
  language. `supabase_typegen` for Dart is the first.

This is why the registry is its own package rather than part of
`postgrest-typegen`: once the TypeScript generator is imported from
supabase-js, which itself imports `postgrest-typegen`'s types, a registry
inside `postgrest-typegen` would close a dependency cycle. A registry above
both does not.

## Languages

| `--lang`     | Runs           | How                                                     | Flags                                                                              |
| ------------ | -------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `typescript` | in-process     | `generateTypescript` from `@supabase/postgrest-typegen` | consumer: `detect-one-to-one-relationships`, `postgrest-version`, `default-schema` |
| `go`         | in-process     | `generateGo` from `@supabase/postgrest-typegen`         |                                                                                    |
| `python`     | in-process     | `generatePython` from `@supabase/postgrest-typegen`     |                                                                                    |
| `swift`      | in-process     | `generateSwift` from `@supabase/postgrest-typegen`      | `--swift-access-control internal\|public\|private\|package`                        |
| `dart`       | out-of-process | `dart run supabase_typegen --output -` in the project   |                                                                                    |

The four in-process entries are a transition: as each generator relocates to
its SDK repository (SDK-1641), its entry here changes to an out-of-process
command, or for TypeScript to an import of the new npm package, and consumers
notice nothing but a dependency bump.

## Using the registry

```ts
import {
  createNodeHost,
  findLanguage,
  introspect,
  TypegenError,
} from "@supabase/typegen";

const language = findLanguage(lang);
if (!language) {
  throw new Error(`unknown language ${lang}`);
}

const metadata = await introspect(pool, { includedSchemas: ["public"] });
const host = createNodeHost({ cwd: process.cwd() });
const code = await language.generate(metadata, { "swift-access-control": "public" }, host);
process.stdout.write(code);
```

`languages` is the full list in display order, and each entry's `options`
describes its flags declaratively (`name`, `audience`, `kind`, `default`,
`help`, `choices`), so a consumer can render every language's flags without
knowing the languages. Option names are the flag names without dashes and are
also the keys of the values passed to `generate`. Missing values take the
defaults; unknown names and values outside a choice raise an
`InvalidOptionError`.

`audience` says who sets an option. `user` options are the CLI flags; render
`options.filter((option) => option.audience === "user")`. `consumer` options
are set by the calling program from what it knows about the target and never
shown to users. TypeScript has three: `detect-one-to-one-relationships`
(default on; the consumer turns it off for PostgREST 9 and below, where
one-to-one joins come back as arrays), `postgrest-version` (emitted as
`__InternalSupabase.PostgrestVersion`) and `default-schema` (default
`public`). postgres-meta's hosted route sets them from its
`detect_one_to_one_relationships` query parameter, `POSTGREST_VERSION` and
`GENERATE_TYPES_DEFAULT_SCHEMA`. The Supabase CLI already sniffs the local
stack's PostgREST version and used to expose the first one inverted as
`--postgrest-v9-compat`, usable only with `--db-url`; its adapter keeps that
flag as a deprecated alias that sets the option to `false`.

`generate` sorts the metadata with `sortGeneratorMetadata` itself, so callers
may pass `introspect()`'s output directly. It returns the complete contents of
the generated file for every language, so the consumer writes the result as-is
with no per-language handling. For the in-process entries that means the
generator's template plus the final newline `supabase gen types` has always
emitted (pg-meta printed through `console.log`), which keeps the four existing
languages byte-identical; for Dart it is the tool's stdout verbatim, which is
what makes `supabase gen types --lang dart` match `dart run supabase_typegen`
byte for byte.

Hosted consumers that cannot spawn processes, such as postgres-meta's
`/generators/*` routes, filter on `language.inProcess`.

### The `Host`

A `Host` is what the consumer knows and the registry does not:

- `cwd`: the user's project directory. Out-of-process tools run there so they
  pick up the project's own toolchain and dependencies.
- `env`: environment for spawned tools, usually `process.env`.
- `signal`: optional `AbortSignal`; aborting cancels the generation and kills a
  spawned tool.
- `spawn(request)`: optional. Runs a command to completion and resolves with
  its exit code, stdout and stderr. It must reject with an error whose `code`
  is `"ENOENT"` when the executable is not found, as Node's `child_process`
  does. A host that cannot run processes leaves it out; an out-of-process
  language then fails with `SpawnUnavailableError`, so hosted consumers offer
  only `inProcess` languages.
- `format(code, fileName)`: optional. Replaces the formatter of in-process
  generators that format their own output. Only TypeScript does today, through
  `oxfmt`, with the file name `output.ts`. The CLI passes an identity function
  so its output stays byte-identical to what it emits today and `oxfmt` stays
  out of its bundle; leave it out to get each generator's default.

`createNodeHost({ cwd, env, signal, format })` is a ready-made `Host` on
`node:child_process` for consumers without their own process runner. On
Windows it resolves the command through `PATH` and `PATHEXT` and runs `.bat`
and `.cmd` scripts through the command interpreter, since Flutter ships `dart`
as `dart.bat` there and `spawn` cannot start those directly; a command it
cannot find is reported as `ENOENT` like everywhere else. A host built on
another process runner needs the same treatment.

### Errors

Every failure the registry raises extends `TypegenError` and carries the
`language`, so a consumer maps them to its own error model once:

- `InvalidOptionError` (`option`): a value the language's option spec rejects.
- `SpawnUnavailableError` (`tool`): an out-of-process language was asked to
  generate through a host without `spawn`.
- `ToolNotInstalledError` (`tool`, `installHint`): the executable or package an
  out-of-process generator needs is missing in `cwd`. For Dart that is either
  the Dart SDK or the `supabase_typegen` dev dependency of the project.
- `ToolFailedError` (`command`, `exitCode`, `stderr`): the tool exited
  unsuccessfully; the message includes its stderr.
- `MetadataRejectedError` (extends `ToolFailedError`, adds `version`): the tool
  refused the `GeneratorMetadata` document, usually because it does not
  understand this `GENERATOR_METADATA_VERSION`. The fix is updating the tool or
  the CLI so both agree.

Anything a generator throws itself, or a `spawn` rejection other than a missing
executable, passes through unchanged.

## Adding a language

Add an entry to `src/languages/` and list it in `languages`. Two shapes exist:

**In-process** (`inProcessLanguage`): wraps a generator function called in
this process. Every dependency of that generator lands in the CLI bundle, so
this is reserved for the transitional entries and, permanently, for TypeScript
imported from supabase-js.

**Out-of-process** (`externalLanguage`): describes a command line. The registry
runs it in the host's `cwd` with the sorted document from
`serializeGeneratorMetadata` on stdin and returns its stdout as the generated
code. The tool's contract:

- Read the JSON document from stdin; its `version` is
  `GENERATOR_METADATA_VERSION` and its schema is `generatorMetadataJsonSchema`,
  both from `@supabase/postgrest-typegen`.
- Write only the generated code to stdout; diagnostics and summaries go to
  stderr.
- Exit `0` on success. The entry's `classify` maps the tool's other exits to
  the typed failures, for example Dart's exit `65` (data error) to
  `MetadataRejectedError` and its "could not find package" stderr to
  `ToolNotInstalledError` with a `dart pub add` hint.

Language flags are declared as `OptionSpec`s on the entry and reach `generate`
as validated values. Keep names identical to the flags users already know, and
mark settings that only a calling program supplies as `audience: "consumer"`.

Testing splits by ownership: this package unit-tests each entry against a fake
host (arguments, working directory, stdin document, error classification), the
CLI keeps its end-to-end matrix for in-process languages plus a fake external
tool for the handoff, and each SDK repository owns the end-to-end test of its
tool against the CLI (`supabase gen types --lang dart --local` must produce the
same file as `dart run supabase_typegen --local`).

## Development

```bash
bun install
bun run test            # bun:test, no Docker needed
bun run check-types     # tsc --noEmit
bun run format-and-lint # oxfmt + oxlint check
bun run knip            # unused code and dependencies
bun run build           # emits dist/
```

## Releases

Released with release-please as its own component, tagged `typegen/vX.Y.Z`,
and published to npm as `@supabase/typegen` through OIDC trusted publishing.
A change to the `--lang` list or to the `Host`, option or error types is a
change to the CLI's public surface: describe it in the pull request so it
reaches the release notes the CLI reads before bumping.
