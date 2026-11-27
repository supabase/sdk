# @supabase/doc-check

Checks API docs definition files against the schema of supabase.com/docs. Every
SDK repository runs it on the definitions it generates, before the docs site
reads them.

> **Status:** prototype. Not published to npm.

## Use

```bash
doc-check docs/api-docs/definitions
```

It checks every `*.md` file directly in the folder and prints every problem in
every file. A folder with no definitions is a problem too, so a generator that
wrote nothing cannot pass.

Example output:

```
✗ auth-sign-up.md
    /kind must be equal to one of the allowed values
    /id id "auth-signup" does not match the file name

1 of 210 definitions do not match the bundled schema (supabase/supabase@7fba2c3)
```

| Exit code | Meaning                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| 0         | Every definition matches the schema.                                                   |
| 1         | A definition is invalid, or the folder has none.                                       |
| 2         | The check could not run: bad arguments, or the folder or the schema could not be read. |

## Which schema

The docs team owns the schema. The check reads it from one of three places.

| Source                 | Flags                                                               | Network | Same answer every run        |
| ---------------------- | ------------------------------------------------------------------- | ------- | ---------------------------- |
| Bundled copy (default) | none                                                                | no      | yes                          |
| A URL                  | `--schema-url <url>`                                                | yes     | as long as the file is fixed |
| A file in Git          | `--schema-git <repository> --schema-ref <ref> --schema-path <path>` | yes     | for a commit, not a branch   |

```bash
# The schema at a URL (http or https).
doc-check definitions --schema-url https://example.com/definition.schema.json

# The schema of one commit of the docs repository.
doc-check definitions \
  --schema-git https://github.com/supabase/supabase.git \
  --schema-ref 7fba2c37f6208acb7451cacee84c43daa28b6480 \
  --schema-path apps/docs/content/reference-beta/definition.schema.json

# The schema a branch has today.
doc-check definitions \
  --schema-git https://github.com/supabase/supabase.git \
  --schema-ref jeremias/reference-beta \
  --schema-path apps/docs/content/reference-beta/definition.schema.json
```

For the Git source:

- `--schema-git` is anything `git fetch` accepts: an HTTPS or SSH URL, or the
  path of a local checkout. A private repository works with the credentials Git
  already has.
- `--schema-ref` is a branch, a tag or a full commit SHA. An abbreviated SHA is
  not accepted, because a server cannot be asked for one.
- The check fetches one commit and one file, not the repository. Against
  supabase/supabase that takes a few seconds.
- The report names the commit that was read, so a run against a branch still
  says what it checked:
  `All 210 definitions match the schema at <repository>@<commit>`.

When to use which:

- **Pull requests:** the bundled copy, or a commit. The result then depends only
  on the pull request.
- **A scheduled job:** a branch, to learn that the docs schema changed before
  the docs build fails on it.

A schema with a keyword the check does not know is an error (exit 2), not a
warning. Skipping the keyword would pass definitions the docs site rejects.

## What it checks

| Check                                                 | Why                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| The file name is lowercase words separated by hyphens | The docs site rejects other names.                         |
| The file has YAML frontmatter that parses             |                                                            |
| The frontmatter matches the schema                    | The schema is closed: an unknown key fails the docs build. |
| `id` equals the file name                             | JSON Schema cannot express it.                             |
| Example ids are unique within a definition            | The schema calls them "stable within the definition".      |

The frontmatter is parsed with gray-matter, as the docs site does. That is a
YAML 1.1 parser: it reads a bare `2026-01-01` as a timestamp, not a string. A
value that passes here is a value the docs site reads the same way.

The check does not import the generator.

## The bundled schema

[`schema/definition.schema.json`](schema/definition.schema.json) is a copy of
the docs team's schema. `BUNDLED_SCHEMA` in [`src/schema.ts`](src/schema.ts)
records the repository, commit, path and SHA-256 it came from. A test fails when
the file no longer matches the hash.

To update it, download the new file, then update `commit` and `sha256`:

```bash
gh api "repos/supabase/supabase/contents/apps/docs/content/reference-beta/definition.schema.json?ref=<commit>" \
  -H "Accept: application/vnd.github.raw" > schema/definition.schema.json
shasum -a 256 schema/definition.schema.json
```

## From code

```ts
import {
  checkDirectory,
  compileSchema,
  readSchema,
} from "@supabase/doc-check";

const schema = await readSchema({
  kind: "git",
  repository: "https://github.com/supabase/supabase.git",
  ref: "7fba2c37f6208acb7451cacee84c43daa28b6480",
  path: "apps/docs/content/reference-beta/definition.schema.json",
});
const result = checkDirectory("definitions", compileSchema(schema.text));
```

`checkDirectory`, `checkDefinitions` and `checkDefinitionFile` use the bundled
schema when they are given none.

## Development

```bash
bun install
bun test
bun run check-types
bun run format-and-lint
bun run knip
bun run build   # tsc, emits dist/ for Node
```

`test/corpus/valid` holds definitions that must pass. `test/corpus/invalid`
holds one file for each way a definition can be wrong, including the four the
docs team's guide says a check must be seen to fail on: a bad `kind`, an unknown
key, a renamed `id` and a missing `summary`.

The schema sources are tested against the real thing, with no network: a local
HTTP server and a Git repository created in a temporary folder. The tests need
`git` on the path.
