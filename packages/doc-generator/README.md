# @supabase/doc-generator

This package generates the API docs definitions that supabase.com/docs reads,
from the doc comments an SDK already has. One generator exists for every SDK. An
SDK repository just needs to add a config file, this generator will do the rest.

> **Status:** prototype. Not published to npm. Two of the seven SDKs have a
> source format today: Swift and Python. See
> [Supported formats](#supported-formats).

## Where it sits

```
language doc tool      swift build -emit-symbol-graph, griffe dump, ...
      |                run by the SDK repository
      v
source adapter         src/sources/<language>: tool output -> API model
      |
      v
generate()             API model -> definition files
      |                pure: no file system, no clock, no network
      v
definitions/<id>.md    YAML frontmatter + Markdown notes
      |
      v
@supabase/doc-check    a separate package, checks the files against the schema
```

The generator and the check are separate programs on purpose: the check does not
trust the generator, and parses the files with the parser the docs site uses.

## Use it in an SDK repository

The SDK repository holds a small Node project with two files.

`package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "doc-generator",
    "check": "doc-check ../../docs/api-docs/definitions",
    "preview": "doc-generator preview"
  },
  "devDependencies": {
    "@supabase/doc-check": "...",
    "@supabase/doc-generator": "..."
  }
}
```

`doc-generator.config.mjs`:

```js
import { defineConfig } from "@supabase/doc-generator";

export default defineConfig({
  source: {
    format: "swift-symbol-graph",
    directory: "../../.build/api-docs/symbol-graphs",
    modules: ["Auth", "Storage"],
  },
  output: "../../docs/api-docs/definitions",
  preview: { path: "swift", title: "Swift" },
});
```

The SDK repository runs its doc tool first, then `doc-generator`, then
`doc-check`.

### Options

| Option            | What it does                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--config <file>` | Reads this config file instead of `./doc-generator.config.mjs`.                                                         |
| `--verbose`       | Lists the functions without a doc comment, and those `exclude` leaves out.                                              |
| `--strict`        | Makes a function without a doc comment an error, as `strict: true` in the config does. See [Strict mode](#strict-mode). |
| `--help`, `-h`    | Prints the usage.                                                                                                       |

An option it does not know stops it: it prints the usage and exits with code 2.
The options of `doc-check` are in its README, under
[Which schema](../doc-check/README.md#which-schema).

One command of the SDK repository does all three: a make target, a script. It
takes the options of the two tools in two variables and hands them on as
written. The names are the same in every SDK, so an option is given the same way
everywhere, and a new option needs no change in an SDK repository.

| Variable        | Goes to         | Example                           |
| --------------- | --------------- | --------------------------------- |
| `GENERATE_ARGS` | `doc-generator` | `GENERATE_ARGS="--verbose"`       |
| `CHECK_ARGS`    | `doc-check`     | `CHECK_ARGS="--schema-url <url>"` |

| SDK            | Command                 | With an option                                    |
| -------------- | ----------------------- | ------------------------------------------------- |
| supabase-swift | `./scripts/api-docs.sh` | `GENERATE_ARGS="--verbose" ./scripts/api-docs.sh` |
| supabase-py    | `make api-docs`         | `make api-docs GENERATE_ARGS="--verbose"`         |

Each command reads the variables from the environment, so
`GENERATE_ARGS="--verbose" <command>` works in every SDK. make also takes them
after the target.

Nothing else is needed. Every public function gets a definition, with a doc
comment or without one, and its id is made from its name. See
[What gets generated](#what-gets-generated).

## Config

Paths are relative to the config file. The config is data only. An unknown key
is an error.

| Key       | Required | Meaning                                                                                                                                                                              |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source`  | yes      | Where the API comes from, and in which format. See below.                                                                                                                            |
| `output`  | yes      | Folder for the definition files.                                                                                                                                                     |
| `exclude` | no       | Functions to leave out: regular expressions matched against the name an id is made from, such as `AuthClient.signUp`. A pattern that matches no function is an error. Default: none. |
| `strict`  | no       | `true` makes a public function without a doc comment an error. `--strict` does the same for one run. See [Strict mode](#strict-mode). Default: `false`.                              |
| `preview` | no       | Where the docs site shows the SDK. Only `doc-generator preview` needs it. See [Preview on the docs site](#preview-on-the-docs-site).                                                 |

### `source.format: "swift-symbol-graph"`

Reads the `*.symbols.json` files the Swift compiler emits.

| Key         | Required | Meaning                                                                      |
| ----------- | -------- | ---------------------------------------------------------------------------- |
| `directory` | yes      | Folder with the graphs of one build.                                         |
| `modules`   | yes      | The modules to document. Graphs of other modules (dependencies) are ignored. |

### `source.format: "griffe"`

Reads the JSON that `griffe dump --full --docstyle google` writes. `--full` is
required: only a full dump says what is public. The docstrings have to be in
Google style: see [Google style](src/sources/python/README.md#google-style).

| Key             | Required | Meaning                                                                                                                                                                                                         |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`          | yes      | The dump.                                                                                                                                                                                                       |
| `unwrapReturns` | no       | Canonical paths of wrapper types. A method declared to return `Wrapper[T]` is documented as returning `T`, with an `async` form in the notes.                                                                   |
| `symbolPaths`   | no       | How a user reaches a class, by the import path of the class: `{ "supabase_auth.SyncAuthClient": "supabase.auth" }`. It changes the `symbol` of a definition, not its id. A key that names no class is an error. |

## Preview on the docs site

`doc-generator preview <docs-checkout>` copies the definitions in `output` into
a local checkout of supabase/supabase. Then it starts the docs site there
(`pnpm dev:docs`) and opens the page in a browser once the site listens. It
shows the definitions as supabase.com will. Nothing has to be pushed. Ctrl-C
stops the docs site.

```bash
doc-generator                                     # generate
doc-check ../../docs/api-docs/definitions         # check
doc-generator preview ../../../supabase-docs      # copy, start the docs site, open the page
```

- When something already listens on the docs site's port, the preview takes it
  for the docs site and only opens the page.
- `--copy-only` copies the definitions and prints how to start the docs site,
  without starting it.

It needs a `preview` entry in the config:

| Key     | Required | Meaning                                                                                               |
| ------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `path`  | yes      | Where the docs site mounts the SDK: `swift` is `/docs/reference-beta/swift`. A version is `swift/v3`. |
| `title` | yes      | The SDK's name on the docs site, for the placeholder introduction page.                               |

What it does in the docs checkout, below `apps/docs/content/reference-beta/`:

- `<path>/definitions/` gets the definitions. Those of an earlier preview are
  replaced. The docs checkout ignores this folder in Git.
- `<path>/index.md` is the library's introduction page, which the docs team
  writes. When there is none, the preview writes a placeholder with the title
  and the language of the signatures. It never overwrites one.
- Nothing else is touched.

The docs checkout has to be on a branch that has the new reference pages. On any
other branch the command stops with an error. The folder names and the URL are
the docs team's. They are written down in one place,
[`src/preview.ts`](src/preview.ts).

## What gets generated

- **One definition per function:** every public function, method and
  initializer, with a doc comment or without one. No list says which ones. What
  is public is the language's own rule, read by the source adapter.
- **`id`** is the name of the function in lowercase words. The name is how the
  language tells the function from every other one, without what tells overloads
  apart.
- **`category`** is the module or package the function belongs to.
- **Overloads share one definition.** It documents the first one in source order
  that has a doc comment, or the first one when none has. The others go to the
  Markdown notes as "Other signatures", because the schema has one `signature`.
- **Option types are inlined** as `children`, recursively, with a guard against
  types that contain themselves.
- **Without a doc comment, and counted in the report:** the definition has the
  signature, parameters and types, an empty `summary` and no `description`.
  `--verbose` lists these functions, and [Strict mode](#strict-mode) makes each
  one an error.
- **Left out, and counted in the report:** a function that `exclude` matches.
  `--verbose` lists their names.
- **Errors:** two functions that give one `id`, and an `exclude` pattern that
  matches no function. Every instance is listed, and nothing is written.

How each language decides:

| Language | Public is                                                           | The name of a function                                 | Example name                                   | Its `id`                                          |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------- |
| Swift    | What the symbol graphs hold. The build emits them at `public`.      | The path through the types, without module and labels. | `AuthClient.signUp`                            | `auth-client-sign-up`                             |
| Python   | What can be imported by public names alone: `__all__`, underscores. | The import path. A path in the defining package wins.  | `supabase_auth.SyncSupabaseAuthClient.sign_up` | `supabase-auth-sync-supabase-auth-client-sign-up` |

An id belongs to one SDK. The same feature has a different id in each language,
and nothing ties the ids of two SDKs together. Within one SDK an id changes only
when the function, its type or its place in the public API is renamed.

The pages under [Writing doc comments](#writing-doc-comments) have the rules of
each language in full.

## Strict mode

`strict: true` in the config, or `doc-generator --strict` for one run, is the
check that every public function is documented. It is one rule for every SDK
that has a source adapter, and it uses the same reading of "public" that decides
which pages exist.

- A public function without a doc comment is an error. The run lists every one
  of them, writes nothing and exits 1. The definitions of the run before stay as
  they are.
- A function counts as documented when its doc comment gives a summary. For
  overloads, one documented overload is enough.
- `exclude` is the way to accept a function without a doc comment: what it
  leaves out is not checked.
- It covers what gets a definition: functions, methods and initializers. Types
  and properties are not checked.

```
doc-generator: Cannot generate the definitions. `strict` is on: give every function a doc comment, or leave it out with `exclude`:
  - notes.AsyncNotesClient.archive has no doc comment
  - notes.NotesClient.in_folder has no doc comment
  - notes.SyncNotesClient.archive has no doc comment
```

Without strict mode, the same functions get a definition with an empty
`summary`, are counted in the report, and the run succeeds.

## Writing doc comments

A definition comes from the doc comment of one function and from its
declaration. Each language has a page next to its adapter. It says which
functions get a definition, how the id is made, and what each part of a doc
comment turns into, with one complete example. The Python page is a lookup: one
entry for each part of a docstring, with how to write it and what it becomes.

| Language                  | Doc comments     | Page                                                                      |
| ------------------------- | ---------------- | ------------------------------------------------------------------------- |
| Swift                     | DocC             | [`src/sources/swift`](src/sources/swift/README.md)                        |
| Python                    | Docstrings       | [`src/sources/python`](src/sources/python/README.md)                      |
| JavaScript and TypeScript | TSDoc            | [`src/sources/javascript`](src/sources/javascript/README.md), placeholder |
| Dart                      | dartdoc          | [`src/sources/dart`](src/sources/dart/README.md), placeholder             |
| Go                        | Go doc comments  | [`src/sources/go`](src/sources/go/README.md), placeholder                 |
| C#                        | XML doc comments | [`src/sources/csharp`](src/sources/csharp/README.md), placeholder         |
| Kotlin                    | KDoc             | [`src/sources/kotlin`](src/sources/kotlin/README.md), placeholder         |

The examples and the ids on the Swift and Python pages come from the fixtures of
this package. A test fails when a page and the generator disagree.

## Determinism

The same input gives the same bytes:

- `generate()` is a pure function. Its tests run it twice and with the input in
  reverse order.
- Definitions are sorted by `id`. Parameters and properties keep source order.
- An `id` is made from the name of a function and nothing else. No counter and
  no order of the input goes into it.
- Keys are written in the docs schema's order, whatever order they were set in.
- No absolute path, timestamp or tool version reaches a definition.
- Every string is quoted or a literal block, so a YAML 1.1 parser (the docs
  site) and a YAML 1.2 parser read the same values. Lines are never folded.
- The output folder is cleared of old definitions first. Only files that are
  recognizably definitions are removed.

What the generator cannot pin is the doc tool. Pin its version in the SDK
repository: the Swift toolchain, griffe and the Python it runs on.

## Supported formats

One row for each SDK. The generator input is the file the SDK's doc tool writes
and a source adapter here reads.

| SDK              | Doc comments            | Generator input                                                         | `source.format`      | Adapter     | SDK repository        |
| ---------------- | ----------------------- | ----------------------------------------------------------------------- | -------------------- | ----------- | --------------------- |
| supabase-swift   | DocC (`///`)            | Symbol graphs, emitted by the Swift compiler                            | `swift-symbol-graph` | Done        | Prototype, not merged |
| supabase-py      | Google style docstrings | `griffe dump` JSON                                                      | `griffe`             | Done        | Prototype, not merged |
| supabase-js      | TSDoc                   | TypeDoc JSON                                                            | none yet             | Not started | Not started           |
| supabase-flutter | dartdoc (`///`)         | None yet. `package:analyzer` is a Dart API and writes no file.          | none yet             | Not started | Not started           |
| supabase-go      | Go doc comments         | None yet. `go/packages` and `go/doc` are Go APIs and write no file.     | none yet             | Not started | Not started           |
| supabase-csharp  | XML doc comments        | None yet. Roslyn is a .NET API, over the built DLLs and their XML docs. | none yet             | Not started | Not started           |
| supabase-kt      | KDoc                    | None yet. Dokka holds its model in memory. A Dokka plugin can dump it.  | none yet             | Not started | Not started           |

What the columns mean:

- **Adapter, done:** an adapter in `src/sources/`, a fixture package with the
  real tool's output checked in, golden files, and a run against the SDK itself
  whose output passes `doc-check`.
- **SDK repository, prototype:** the config file and the command exist on a
  local branch of the SDK repository.

Last runs against the SDKs, on 2026-11-23, with no `exclude`:

| SDK            | At              | Public functions | Definitions | No doc comment |
| -------------- | --------------- | ---------------- | ----------- | -------------- |
| supabase-swift | `main`, da4f9b0 | 547              | 547         | 0              |
| supabase-py    | `main`, ff8a232 | 577              | 577         | 230            |

supabase-swift runs with `strict: true`. supabase-py cannot yet: 230 of its
public functions have no docstring.

Overloads count as one function. A Python special method without a docstring is
not counted, unless it is an `__init__` written by hand. 224 of the Swift
definitions are initializers, and 61 of the Python ones are `__init__` methods.
Both sets pass `doc-check`, and a second run gives the same bytes.

What the SDKs without an adapter need:

- **supabase-js:** an adapter like the two that exist. TypeDoc JSON is a file
  the generator can read as it is.
- **supabase-flutter, supabase-go, supabase-csharp, supabase-kt:** two things,
  and neither exists. Their doc tool writes no file, so a small tool in the
  SDK's language has to write one: the API model of
  [`src/model.ts`](src/model.ts), as JSON. And the generator needs a
  `source.format` that reads that JSON.

### What the two adapters cover

| Definition field                   | `swift-symbol-graph`                                                                                                  | `griffe`                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Which functions                    | Every function, method and initializer in the graphs.                                                                 | Every function and method that public names lead to. An `__init__` written by hand always, other special methods only with a docstring. |
| `id`                               | The path through the types, without module and labels.                                                                | The import path.                                                                                                                        |
| `category`                         | The module that declares the function.                                                                                | The package the import path starts with.                                                                                                |
| `summary`, `description`           | The doc comment. Links become names, `## Topics` is dropped.                                                          | The docstring text. Sections such as `Note:` stay in it, as quotes, and so does code outside `Examples:`.                               |
| `signature`                        | The declaration, with the constraints of the extension it is in.                                                      | The `def` line without the receiver, `async` when it is.                                                                                |
| `parameters[].description`         | `- Parameters:` and `- Parameter x:`                                                                                  | `Args:` and `Other Parameters:`.                                                                                                        |
| `parameters[].default`, `required` | From the declaration.                                                                                                 | From the signature.                                                                                                                     |
| `parameters[].variadic`            | `T...`                                                                                                                | `*args`, `**kwargs`                                                                                                                     |
| `parameters[].allowed_values`      | No.                                                                                                                   | `Literal[...]`                                                                                                                          |
| `parameters[].children`            | Structs of the package. Not classes, not types that wrap a raw value.                                                 | Dataclasses and pydantic models, inherited fields included.                                                                             |
| `returns`                          | `- Returns:`                                                                                                          | The returns or yields section. A wrapper type the config names is seen through.                                                         |
| `throws`                           | `- Throws:`, typed by the first symbol it links.                                                                      | The raises section.                                                                                                                     |
| `type_params`                      | Generic parameters.                                                                                                   | PEP 695 type parameters.                                                                                                                |
| `stability`                        | `@_spi` is `experimental`.                                                                                            | Always `stable`.                                                                                                                        |
| `deprecated`                       | `@available(*, deprecated)`. The message goes to the notes.                                                           | `@deprecated("…")` from `warnings` or `typing_extensions`. The message goes to the notes.                                               |
| `examples`                         | `swift` code blocks of the doc comment.                                                                               | Code blocks and doctests in the `Examples:` section, each titled by the paragraph above it.                                             |
| Overloads                          | One definition. The first documented one leads, or the first one when none is documented. The others go to the notes. | Not available: `griffe dump` leaves `@overload` signatures out.                                                                         |
| Sync and async twins               | Does not apply.                                                                                                       | Two classes, so one definition for each. `exclude` can leave one class out.                                                             |

Not covered by either adapter:

- A `kind` other than `method`. An initializer is a definition of its own, and
  not part of a page for its type.
- Opting in by a doc tag. Every public function is in, and `exclude` is the only
  way out.
- In Python, a method that a public class inherits from a private base class.
  supabase-py has none with a docstring today.
- `since` and `requires`. No SDK has a source for them.
- Example titles in Swift. Its examples are titled "Example N".
- More than one platform for Swift. A symbol graph holds one, so the definitions
  come from a macOS build.

### Adding a language

A source adapter turns tool output into the API model in
[`src/model.ts`](src/model.ts). Everything after that is shared.

1. Add `src/sources/<language>/`, with a pure function from parsed tool output
   to `ApiModel` and a reader for the files. The adapter decides which functions
   are public, and gives each one the name its id is made from.
2. Add the format to `SourceConfig` in [`src/config.ts`](src/config.ts) and to
   `loadModel` in [`src/sources/index.ts`](src/sources/index.ts).
3. Add a fixture package under `test/fixtures/<language>/`, check in the output
   of the real tool, and extend `scripts/refresh-fixtures.sh`.
4. Replace the placeholder `src/sources/<language>/README.md` with the rules for
   what is public and how a name is made, a table of ids, an example doc comment
   and the definition it becomes. All of it comes from the fixture, and
   `test/readme.test.ts` checks it.

When the doc tool writes no file, the adapter is the generic one for the API
model as JSON, which is not built yet, and step 3 uses the output of the SDK's
own tool.

## Development

```bash
bun install
bun test                  # unit tests and golden files
bun run check-types
bun run format-and-lint
bun run knip
bun run build             # tsc, emits dist/ for Node
bun run refresh-fixtures  # rebuild the checked-in tool output and goldens
```

`@supabase/doc-check` is linked from `../doc-check` for the tests, so every
golden file is also run through the check.

### Tests

- **Unit tests** for each mapping: doc comment parsing, declarations, griffe
  expressions, slugs, config, YAML output.
- **Golden files:** `test/fixtures/swift` and `test/fixtures/python` each hold a
  small package, the checked-in output of the real tool and the expected
  definitions. The tests compare byte for byte and need neither Swift nor
  Python.
- **Round trips:** awkward strings (`yes`, `2026-01-01`, `0o644`, `---`) are
  written and read back with both YAML parsers.

`bun run refresh-fixtures` needs macOS with Swift, uv and jq. It rebuilds the
tool output and rewrites the expected definitions. Review the diff: a change
under `expected/` is a change in what every SDK gets.
