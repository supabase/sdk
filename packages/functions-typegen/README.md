# @supabase/functions-typegen

Extracts the request and response contracts of the
[Supabase Edge Functions](https://supabase.com/docs/guides/functions) of a
project into the `edgeFunctions` collection of
[`@supabase/postgrest-typegen`](../postgrest-typegen)'s `GeneratorMetadata`,
the document SDK type generators already read to type tables, so the same
generators can type function calls, for example a generated
`supabase.functions.greet(name: 'Ada')` in Dart.

> **Status:** alpha. The contract convention is settling while the first
> consumer, the Dart `supabase_typegen` package, is built against it.

## The contract convention

An Edge Function is arbitrary code, so nothing describes its inputs and
outputs unless the function does. A function declares its contract by
exporting two types from its entrypoint:

```ts
// supabase/functions/greet/index.ts
export type RequestBody = {
  name: string;
  greeting?: "hello" | "hi";
};

export interface ResponseBody {
  message: string;
}

Deno.serve(async (request) => {
  const body = (await request.json()) as RequestBody;
  const response: ResponseBody = {
    message: `${body.greeting ?? "hello"} ${body.name}`,
  };
  return Response.json(response);
});
```

`RequestBody` describes the JSON body the function accepts and `ResponseBody`
the JSON body it answers with. Either may be left out, and an alias to an
existing type is enough (`export type RequestBody = CreateOrderInput;`). A
function without them still appears in the document by name, so a generated
method can at least check that the function exists. Both must be exported
type aliases, interfaces or enums without type parameters. The names avoid
`Request` and `Response` on purpose: those are globals in the edge runtime,
and shadowing them in type position would silently change what a handler's
`(request: Request)` annotation means.

This is an explicit opt-in per function. The extractor follows the two
exports through imports, generics, enums, `extends` and intersections, but it
does not infer a contract from the handler's code.

The types may reference other types declared anywhere in the project, in the
entrypoint or in modules it imports (a `_shared/` directory, for example).
Generic types are instantiated at the point of use. Types that come from
`npm:`, `jsr:` or remote modules are not followed, and TypeScript constructs
JSON cannot carry (`Date`, methods, `Map`, conditional and mapped types,
`typeof` queries, `z.infer<...>` and friends) are marked `unsupported` in the
document together with a diagnostic naming the spot, so a generator can fall
back to its loosest type there instead of failing.

## How it works

```
supabase/config.toml + supabase/functions/*   discovery (same rules as the CLI)
                 │
                 ▼
          parse each entrypoint                @babel/parser, in process; the
                 │                             function's import map and relative
                 │                             imports resolved to project files
                 ▼
   normalize exported RequestBody/ResponseBody
   and every project type they reach
                 │
                 ▼
            EdgeFunction[]                     sorted, ready for GeneratorMetadata
```

Discovery follows `supabase functions deploy`: every directory under
`supabase/functions/` with an `index.ts`, merged with the `[functions.<slug>]`
tables of `config.toml`, which can point `entrypoint` and `import_map`
elsewhere (relative to the `supabase/` directory), turn `verify_jwt` off or
set `enabled = false`, in which case the function is left out. When
`config.toml` names no import map, the CLI's lookup order applies:
`deno.json`, `deno.jsonc` or the deprecated `import_map.json` next to the
entrypoint, then the shared `supabase/functions/import_map.json`.

Everything runs in this process on the project's source files. Nothing is
executed, no network is used and no toolchain is needed beyond what runs the
extractor: `@babel/parser` reads full TypeScript syntax, and the import map
(`imports` and `scopes`, JSON with comments accepted) plus the extension
fallbacks Deno and TypeScript accept map specifiers to project files. Modules
are parsed lazily on first reference and once per function.

A missing entrypoint, an unreadable import map or a syntax error becomes a
diagnostic on that function, never an exception, so one broken function does
not hide the others.

## Usage

The package is ES modules only.

```ts
import { extractEdgeFunctions } from "@supabase/functions-typegen";
import {
  introspect,
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";

const metadata = sortGeneratorMetadata({
  ...(await introspect(pool, { includedSchemas: ["public"] })),
  // `projectRoot` is the directory holding `supabase/`.
  edgeFunctions: await extractEdgeFunctions({ projectRoot: process.cwd() }),
});

// The JSON document an out-of-process generator reads.
const json = serializeGeneratorMetadata(metadata);
```

`extractEdgeFunctions` returns the collection already sorted with
postgrest-typegen's `sortEdgeFunctions` (functions by slug, declarations by
name, diagnostics by path and message, with a fixed English collation), so
the same project yields the same bytes on every machine. Paths in the result
are relative to the project root in POSIX form.

### Discovery, parsing and normalization on their own

```ts
import {
  discoverFunctions,
  normalizeContract,
  parseModule,
} from "@supabase/functions-typegen";

// The deployable functions and their entrypoints, without reading any source.
const functions = await discoverFunctions({ projectRoot });

// One module as the normalizer sees it: imports, re-exports, declarations.
const module = parseModule({ url, source, resolve });

// The contract of one function from modules you already have, keyed by URL.
const contract = normalizeContract({ entrypointUrl, modules });
```

## The document

The shape of each entry, and the `ContractType` type language the bodies use,
are defined and documented by `@supabase/postgrest-typegen` (see "Edge
Function contracts" in its README). In short:

```jsonc
{
  "slug": "greet",
  "entrypoint": "supabase/functions/greet/index.ts",
  "importMap": "supabase/functions/greet/deno.json",
  "verifyJwt": true,
  "requestBody": {
    "kind": "object",
    "properties": [
      { "name": "name", "type": { "kind": "string" }, "optional": false },
      {
        "name": "greeting",
        "type": {
          "kind": "union",
          "members": [
            { "kind": "literal", "value": "hello" },
            { "kind": "literal", "value": "hi" }
          ]
        },
        "optional": true
      }
    ]
  },
  "responseBody": { "kind": "reference", "name": "Greeting" },
  "types": [
    {
      "name": "Greeting",
      "type": {
        "kind": "object",
        "properties": [
          { "name": "message", "type": { "kind": "string" }, "optional": false }
        ]
      }
    }
  ],
  "diagnostics": [
    { "path": "RequestBody.when", "message": "Date cannot be expressed as JSON." }
  ]
}
```

Enums become unions of their literal values, `T | undefined` on a property
becomes an optional property of `T`, `true | false` collapses to `boolean`,
interfaces merge what they extend, and `Record`, `Partial`, `Required`,
`Readonly`, `NonNullable`, `Array` and `ReadonlyArray` are understood.

## Development

```bash
bun install
bun run check-types          # tsc --noEmit
bun run check-types:consumer # the types a consumer bundling this package sees
bun run format-and-lint      # oxfmt + oxlint
bun run knip                 # unused code and dependencies
bun run build                # emits dist/
bun run test                 # bun:test, no Docker, no Deno, no network
bun run update-expected      # regenerate test/fixtures/expected/project.json
```

The end-to-end test runs the extractor on the fixture project under
`test/fixtures/project/` and compares the whole result with
`test/fixtures/expected/project.json`. After an intentional change, regenerate
the file and review the diff: every change there is a change every consumer
sees.

## License

MIT
