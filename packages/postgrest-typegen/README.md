# @supabase/postgrest-typegen

Type generation for [PostgREST](https://postgrest.org) from a PostgreSQL
schema. This is the type-generation engine behind `supabase gen types`,
extracted from [postgres-meta](https://github.com/supabase/postgres-meta) into a
small, driver-agnostic library.

> **Status:** alpha. The public API is settling as generators and introspection
> are ported.

## Scope: introspection is permanent, four generators are transitional

This package's permanent job is introspection and the `GeneratorMetadata`
contract (see "Out-of-process generators" below): any *new* language's
generator lives in that language's own SDK repo, consuming this package's
JSON output, not inside `postgrest-typegen`.

The TypeScript, Go, Python, and Swift generators bundled here are a
**deliberate transition**, not the target architecture for new languages.
They were ported byte-parity from postgres-meta's own templates so
`supabase gen types` keeps working unchanged while postgres-meta's copies get
deprecated in favor of this package. It's decided that all four eventually
move out to their own SDK repos too (tracked in SDK-1641), not yet scheduled
— sequenced after postgres-meta's cutover to this package settles.

> [!IMPORTANT]
> **We are no longer accepting contributions that fix the bundled generators.**
> Because each of the four is moving out to its own language's SDK repository,
> a fix landed here would have to be made a second time in the destination
> repository, and it also breaks byte parity with postgres-meta until a release
> propagates. Please open an issue describing the bug instead, so it can be
> tracked and carried across the move.

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

The Go/Python/Swift generators emit tables, views, and materialized views in
`GeneratorMetadata` order, so their output depends on how the producer ordered
its collections (a SQL introspector returns rows in environment-dependent heap
order). `sortGeneratorMetadata` is a pure pass that canonically sorts every
collection; **apply it after introspection and before any `generate*` call** so
output is deterministic regardless of the producer. Generators expect
pre-sorted input and do not re-sort it themselves.

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

`GeneratorMetadata.version` is bumped whenever the shape changes in a way a
consumer should branch on, since an out-of-process consumer only sees the
serialized document and can't otherwise detect a shape change until something
breaks at read time.

### Generators

```ts
import {
  generateTypescript, // async (uses prettier)
  generateGo,
  generatePython,
  generateSwift,
} from "@supabase/postgrest-typegen/generation";
```

| Function             | Options                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `generateTypescript` | `{ detectOneToOneRelationships?, postgrestVersion?, defaultSchema? }`    |
| `generateGo`         | —                                                                       |
| `generatePython`     | —                                                                       |
| `generateSwift`      | `{ accessControl?: 'internal' \| 'public' \| 'private' \| 'package' }`   |

## Installation

Not yet published; consumed in-repo for now (`packages/postgrest-typegen`).

```bash
# pg is a peer of your application, not bundled here
npm install pg
```

## Releasing

Unlike the rest of this repo, merging a change here does not open a release pull request on its own. Releases are cut on demand: run the `Release postgrest-typegen` workflow from the Actions tab, which runs release-please against `release-please-config.postgrest-typegen.json` and opens (or updates) the release pull request for this package. Merging that pull request tags the release and publishes to npm.

## License

MIT
