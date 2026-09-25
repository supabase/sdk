# @supabase/functions-typegen

Extracts the request and response contracts of the
[Supabase Edge Functions](https://supabase.com/docs/guides/functions) of a
project into `EdgeFunctionsMetadata`, a language-neutral JSON document that SDK
type generators turn into typed functions, for example a generated
`supabase.functions.greet(name: 'Ada')` in Dart.

> **Status:** alpha. The document shape and the contract convention are
> settling while the first consumer, the Dart `supabase_typegen` package, is
> built against them.

## The contract convention

An Edge Function is arbitrary Deno code, so nothing describes its inputs and
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
  const response: ResponseBody = { message: `${body.greeting ?? "hello"} ${body.name}` };
  return Response.json(response);
});
```

`RequestBody` describes the JSON body the function accepts and `ResponseBody`
the JSON body it answers with. Either may be left out; a function without
them still appears in the document by name, so a generated method can at
least check the function exists. Both must be exported type aliases,
interfaces or enums without type parameters. The names avoid `Request` and
`Response` on purpose: those are globals in Deno, and shadowing them in type
position would silently change what a handler's `(request: Request)`
annotation means.

The types may reference other types declared anywhere in the project, in the
entrypoint or in modules it imports (a `_shared/` directory, for example).
Generic types are instantiated at the point of use. Types that come from npm,
JSR or remote modules are not followed, and TypeScript constructs JSON cannot
carry (`Date`, methods, `Map`, conditional and mapped types, `typeof`
queries, `z.infer<...>` and friends) are marked `unsupported` in the document
together with a diagnostic naming the spot, so a generator can fall back to
its loosest type there instead of failing.

## How it works

```
supabase/config.toml + supabase/functions/*   discovery (same rules as the CLI)
                 │
                 ▼
     deno doc --json --private <entrypoint>   one run per function, from the
                 │                            project root, with the function's
                 │                            import map (deno.json or other)
                 ▼
   normalize exported RequestBody/ResponseBody
   and every project type they reach
                 │
                 ▼
           EdgeFunctionsMetadata               sorted, versioned JSON
```

Discovery follows `supabase functions deploy`: every directory under
`supabase/functions/` with an `index.ts`, merged with the `[functions.<slug>]`
tables of `config.toml`, which can point `entrypoint` and `import_map`
elsewhere (relative to the `supabase/` directory), turn `verify_jwt` off or
set `enabled = false`, in which case the function is left out. When
`config.toml` names no import map, the CLI's lookup order applies:
`deno.json`, `deno.jsonc` or the deprecated `import_map.json` next to the
entrypoint, then the shared `supabase/functions/import_map.json`.

`deno doc` resolves the module graph of the entrypoint, so it needs whatever
the function imports to be resolvable: a warm Deno cache or network access
for `npm:` and `jsr:` specifiers. It never writes the project's lockfile
(`--no-lock`), never type-checks and never runs the function.

## Usage

The package is ES modules only.

```ts
import {
  createLocalDenoRunner,
  extractEdgeFunctionsMetadata,
  serializeEdgeFunctionsMetadata,
} from "@supabase/functions-typegen";

const metadata = await extractEdgeFunctionsMetadata({
  projectRoot: "/path/to/project", // the directory holding supabase/
  deno: createLocalDenoRunner(), // the `deno` binary on PATH
});

// The JSON document an out-of-process generator reads.
const json = serializeEdgeFunctionsMetadata(metadata);
```

### Bring your own Deno

The extractor only needs something that can run `deno` from the project root.
`createLocalDenoRunner` runs the binary found on `PATH` through
`node:child_process`. A consumer that already owns a process runner wraps it
with `createSpawnDenoRunner`; the request and result shapes are the same as
the `Host.spawn` of `@supabase/typegen`, so the registry passes its host's
`spawn` straight in:

```ts
import { createSpawnDenoRunner } from "@supabase/functions-typegen";

const deno = createSpawnDenoRunner(host.spawn, { env: host.env, signal: host.signal });
// Or point it at a specific executable, such as a downloaded release:
const pinned = createSpawnDenoRunner(host.spawn, { command: "/path/to/deno" });
```

Before the first `deno doc`, the extractor runs `deno --version` once. When
that fails, the document lists every function without a contract and carries
one project-level diagnostic (empty `slug`) saying so, and nothing is thrown,
so a consumer that also generates database types still gets those.

Planned next: a managed runner that downloads a pinned, checksum-verified
Deno release when none is installed, and a `functions-typegen` command so the
package can be run directly with `npx`, `bunx` or `deno run npm:`.

### Discovery and normalization on their own

```ts
import { discoverFunctions, normalizeContract } from "@supabase/functions-typegen";

// The deployable functions and their entrypoints, without running Deno.
const functions = await discoverFunctions({ projectRoot });

// The contract of one function from a `deno doc --json` output you already
// have, keyed by module URL.
const contract = normalizeContract({ slug, entrypointUrl, modules });
```

## The document

```jsonc
{
  "version": 1,
  "functions": [
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
      ]
    }
  ],
  "diagnostics": [
    {
      "slug": "greet",
      "path": "RequestBody.when",
      "message": "Date cannot be expressed as JSON."
    }
  ]
}
```

Paths are relative to the project root in POSIX form. Every collection is
sorted (functions by slug, declarations by name, diagnostics by function,
path and message) with a fixed English collation, so the same project yields
the same bytes on every machine.

### Type nodes

| `kind`        | Fields                                        | Meaning                                                                 |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `string`, `number`, `boolean`, `null` |                       | JSON scalars                                                            |
| `unknown`     |                                               | `any` or `unknown`: anything JSON can carry                              |
| `literal`     | `value`                                       | one string, number or boolean value                                     |
| `array`       | `element`                                     | JSON array of one type                                                  |
| `tuple`       | `elements`                                    | JSON array with one type per position                                   |
| `object`      | `properties`, `additionalProperties?`         | named properties (`name`, `type`, `optional`), plus the type of other keys when the source had an index signature |
| `record`      | `key`, `value`                                | JSON object whose keys are all `string` or a union of string literals   |
| `union`       | `members`                                     | one of the members                                                      |
| `reference`   | `name`                                        | a declaration in the function's `types`                                 |
| `unsupported` | `repr`                                        | a construct JSON cannot carry; `repr` is the source text                |

Enums become unions of their literal values, `T | undefined` on a property
becomes an optional property of `T`, `true | false` collapses to `boolean`,
interfaces merge what they extend, and `Record`, `Partial`, `Required`,
`Readonly`, `NonNullable`, `Array` and `ReadonlyArray` are understood.

### Runtime validation

The document is backed by an [ArkType](https://arktype.io) schema. A consumer
receiving it from somewhere other than `extractEdgeFunctionsMetadata` can
validate it instead of casting:

```ts
import { parseEdgeFunctionsMetadata } from "@supabase/functions-typegen";

// Throws a TypeError with a readable summary when the shape is wrong.
const metadata = parseEdgeFunctionsMetadata(JSON.parse(json));
```

`version` is bumped whenever the shape changes in a way a consumer should
branch on.

## Development

```bash
bun install
bun run check-types      # tsc --noEmit
bun run format-and-lint  # oxfmt + oxlint
bun run knip             # unused code and dependencies
bun run build            # emits dist/
bun run test             # needs the `deno` binary on PATH
bun run update-expected  # regenerate test/fixtures/expected/project.json
```

The end-to-end test runs `deno doc` on the fixture project under
`test/fixtures/project/` and compares the whole document with
`test/fixtures/expected/project.json`. After an intentional change, regenerate
the file and review the diff: every change there is a change every consumer
sees.

## License

MIT
