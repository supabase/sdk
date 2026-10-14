# @supabase/postgrest-typegen

Type generation for [PostgREST](https://postgrest.org) from a PostgreSQL
schema: the type-generation engine behind `supabase gen types`, as a small,
driver-agnostic library.

> **Status:** alpha. The public API may still change between minor versions.

## Scope: introspection is permanent, three generators are transitional

This package's permanent job is introspection and the `GeneratorMetadata`
contract (see "Out-of-process generators" below): any *new* language's
generator lives in that language's own SDK repo, consuming this package's
JSON output, not inside `postgrest-typegen`.

The TypeScript, Go, and Python generators bundled here are a
**deliberate transition**, not the target architecture for new languages.
They move out one language at a time, TypeScript first into supabase-js, then
Go and Python. Swift's generator is the `supabase-typegen` executable in
[supabase-swift](https://github.com/supabase/supabase-swift), which
`supabase gen types --lang swift` runs.

> [!IMPORTANT]
> **We do not accept contributions that fix the bundled generators.**
> Because each of the three is moving out to its own language's SDK repository,
> a fix landed here would have to be made a second time in the destination
> repository, and postgres-meta and the CLI only pick it up once they bump
> their pinned version of this package. Please open an issue describing the
> bug instead, so it can be tracked and carried across the move.

## Design

There is a hard split between **introspection** (database → metadata) and
**generation** (metadata → string):

```ts
import { introspect } from "@supabase/postgrest-typegen/introspection";
import {
  generateTypescript,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen/generation";

// Any `pg.Pool` / `pg.Client` (or compatible driver) works here.
const metadata = await introspect(pool, { includedSchemas: ["public"] });
// Canonically sort before generating (see "Stable ordering" below).
const types = await generateTypescript(sortGeneratorMetadata(metadata), {
  postgrestVersion: "12",
});
```

`GeneratorMetadata` is the pluggable contract: the SQL introspector is the
default producer, but any source that can produce that shape can feed the
generators.

### Stable ordering (`sortGeneratorMetadata`)

The Go/Python generators emit tables, views, and materialized views in
`GeneratorMetadata` order, so their output depends on how the producer ordered
its collections (a SQL introspector returns rows in environment-dependent heap
order). `sortGeneratorMetadata` is a pure pass that canonically sorts every
collection; **apply it after introspection and before any `generate*` call** so
output is deterministic regardless of the producer. Generators expect
pre-sorted input and do not re-sort it themselves.

### RPC functions (`rpcFunctions`, `resolveRpcFunctions`)

`functions` is `pg_proc` as introspected. Which of those functions PostgREST
exposes under `/rpc`, how overloads group, what a call returns and whether a
function doubles as a computed field or an embeddable relation are PostgREST
rules, so `introspect()` applies them once and attaches the result as
`rpcFunctions`. A generator in any language reads that collection instead of
reimplementing the rules:

```ts
for (const fn of metadata.rpcFunctions ?? resolveRpcFunctions(metadata)) {
  // fn.schema, fn.name, and one entry per overload PostgREST can resolve.
  for (const overload of fn.overloads) {
    overload.args; // input parameters: name, mode, type reference, has_default, relation_id
    overload.returns; // type reference, plus relation_id or RETURNS TABLE columns
    overload.is_set_returning; // the response is an array
    overload.setof_options; // embeddable like a relation: from, to, is_one_to_one
    overload.computed_field_of; // selectable as a column of this relation
    overload.error; // why PostgREST cannot resolve a call, else null
  }
}
```

A type reference carries `type_id`, `format` (the type's name, spelled like
`PostgresColumn.format`) and `type_schema`, so a generator maps it with the
same table it uses for columns. An overload's `error` is the message the
TypeScript generator emits as the `Returns` type of an unresolvable overload:
two overloads PostgREST cannot tell apart, or a computed field that returns no
rows. Overloads are ordered by argument list, then by return type; the
TypeScript generator emits them in that order.

`resolveRpcFunctions` is pure and deterministic, so a custom producer attaches
it the same way, and a document without the collection (produced before it
existed) still generates: the TypeScript generator falls back to running the
pass itself.

### Runtime validation (opt-in)

`GeneratorMetadata` is backed by an [ArkType](https://arktype.io) schema, so a
result coming from a custom/injected producer can be validated at runtime
rather than blindly cast. `introspect()` does **not** validate — wrap its
result yourself when you want the guarantee:

```ts
import { parseGeneratorMetadata, generatorMetadataSchema } from "@supabase/postgrest-typegen";

// Throws a TypeError with a readable summary if the shape is wrong.
const metadata = parseGeneratorMetadata(await someCustomIntrospector(db));

// Or use the raw schema directly for custom flows.
const out = generatorMetadataSchema(unknownInput);
```

### Out-of-process generators (JSON Schema + serialization)

Generators that live outside this package's process, in another language's
own SDK repo, receive `GeneratorMetadata` as JSON rather than a live object.
This package owns that boundary, so no consumer serializes the contract a
different way:

```ts
import {
  serializeGeneratorMetadata,
  generatorMetadataJsonSchema,
} from "@supabase/postgrest-typegen";

// The exact JSON document an out-of-process generator (e.g. `dart run
// supabase_typegen`) receives over stdin/stdout.
const json = serializeGeneratorMetadata(sortGeneratorMetadata(metadata));

// The JSON Schema for that document, for consumers that want to validate or
// codegen against the contract without depending on ArkType or TypeScript.
generatorMetadataJsonSchema;
```

### Contract compatibility (`GeneratorMetadata.version`)

`GeneratorMetadata` is read by code that does not install this package: an
out-of-process generator sees only the serialized document, and postgres-meta
and the Supabase CLI consume it through a pinned registry version. The shape
therefore changes under one rule:

- **A new field is optional and has a documented fallback.** The fallback
  lives in the consumers that read the field, so a document produced by any
  released version still parses and generates what it generated before. The
  view flags `is_insert_enabled` and `is_update_enabled` are the model: they
  are optional, and the TypeScript generator, the only one that emits view
  write types, falls back to `is_updatable` when they are absent. The
  `rpcFunctions` collection follows the same rule: a generator that does not
  find it runs `resolveRpcFunctions` on the raw `functions` itself.
- **Anything else moves `GENERATOR_METADATA_VERSION`:** removing or renaming a
  field, making one required, narrowing its type, or changing what an existing
  value means. The version is `1`.

`parseGeneratorMetadata` and `generatorMetadataJsonSchema` pin the exact
version string, so a consumer on another version fails at parse time with a
clear error instead of misreading the document. An out-of-process generator
should do the same and exit distinctly when it meets a version it does not
know; `@supabase/typegen` maps Dart's exit code 65 to `MetadataRejectedError`
for that reason.

The contract version and the package version are independent:

- `GENERATOR_METADATA_VERSION` changes only with an incompatible shape change.
  A release that moves it is marked breaking in the changelog, and consumers
  that read the serialized document pin this number, not the npm version.
- The package follows semantic versioning and is on `0.x`. A minor release
  may change generated output or the TypeScript
  API, with breaking changes called out in the changelog; a patch release
  changes neither on purpose. The four generators' output is part of the
  public surface: any change to it is described in the pull request so it
  reaches the release notes that postgres-meta and the CLI read before bumping.

Changes to `src/types.ts` and `src/introspection/` are reviewed by
[@spydon](https://github.com/spydon), listed in `CODEOWNERS` for this package
next to the SDK team, so every contract change has one person who checks it
against this rule.

### Generators

```ts
import {
  generateTypescript, // async (formats its output)
  generateGo,
  generatePython,
} from "@supabase/postgrest-typegen/generation";
```

| Function             | Options                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `generateTypescript` | `{ detectOneToOneRelationships?, postgrestVersion?, defaultSchema?, format? }` |
| `generateGo`         | —                                                                              |
| `generatePython`     | —                                                                              |

Every generator returns the complete contents of the generated file, ending
with a single newline, so consumers write the result as-is.

`generateTypescript` formats its output with `oxfmt` unless `format` is
supplied. `oxfmt` is an optional peer dependency, imported only when that
default runs: install it to use the default formatter, or pass your own
`format` (an identity function, for byte-identical unformatted output, or a
worker-pool-backed formatter) and it is never loaded or needed. Calling
`generateTypescript` without `format` when `oxfmt` is missing throws an error
saying so.

## Generating types without database credentials

`GeneratorMetadata` is the pluggable contract, so generating types for a
project without its database password means replacing the introspection
producer, not touching any generator. No such producer ships in this package.

Generating from PostgREST's OpenAPI output needs PostgREST to include the
introspection details the generators depend on: the standard OpenAPI document
alone carries about half of what the TypeScript output needs. That is the
`x-postgrest-typegen-metadata` extension proposed in
[supabase/postgrest#6](https://github.com/supabase/postgrest/pull/6). A
producer that reads it and matches `introspect()` byte for byte exists in
[supabase/pg-toolbelt#303](https://github.com/supabase/pg-toolbelt/pull/303)
and is the starting point for porting one here once the extension is
available.

## Installation

Not yet published; consumed in-repo for now (`packages/postgrest-typegen`).

```bash
# pg is a peer of your application, not bundled here
npm install pg
# only if you rely on generateTypescript's default formatter
npm install oxfmt@0.66.0
```

## postgrest-js type tests

Every pull request that touches this package also runs postgrest-js's type tests against the TypeScript this pull request generates. The `postgrest-js type tests` job in `postgrest-typegen-validate.yml` checks out supabase-js, starts the database fixture in `packages/core/postgrest-js/test/supabase`, writes `test/types.generated.ts` with `bun run generate:postgrest-js-types`, and runs `test:types:ci` over every TypeScript version postgrest-js supports. The assertions are the hand-written `*.test-d.ts` files in supabase-js, so the generated file is allowed to change as long as they keep passing.

To run it locally, start that fixture with `supabase --workdir packages/core/postgrest-js/test db start` in a supabase-js checkout, then:

```bash
bun run generate:postgrest-js-types postgresql://postgres:postgres@127.0.0.1:54322/postgres <supabase-js>/packages/core/postgrest-js/test/types.generated.ts
```

Then run `node scripts/update-json-type.js`, `pnpm exec prettier --write test/types.generated.ts` and `pnpm run test:types:ci` in `packages/core/postgrest-js`.

This job covers TypeScript only. Findings in the Go and Python generators stay with their own unit tests here, and move with those generators to their SDK repositories.

## Releasing

Unlike the rest of this repo, merging a change here does not open a release pull request on its own. Releases are cut on demand: run the `Release postgrest-typegen` workflow from the Actions tab, which runs release-please against `release-please-config.postgrest-typegen.json` and opens (or updates) the release pull request for this package. Merging that pull request tags the release and publishes to npm. Once npm serves the new version, the same workflow opens a pull request that bumps the exact pin in `packages/typegen`.

## License

MIT
