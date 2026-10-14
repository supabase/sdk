# go-symbol-extractor

Extracts the public API surface of a Go SDK repository as JSON, in the
`ParsedSymbol` shape the capability-matrix scripts consume. The Go compliance
workflow uses it to find public symbols that no `sdk-compliance.yaml` entry
lists.

## Usage

```bash
cd packages/go-symbol-extractor
go run . [-module <directory>]... <path-to-sdk-root>
```

The JSON dump goes to stdout, sorted by name and deduplicated.

Each symbol has a `name`, a `kind`, a `file` and a `line`. `kind` is one of `class`, `method`, `property`, `function` or `variable`.
Files that fail to parse are skipped with a warning on stderr, and any other
failure exits with status 1.

## Which modules are read

The published modules are the `use` directives of the `go.work` file at the
SDK root. Repositories without one name their module directories with
repeated `-module` flags, which override `go.work` discovery.

## What counts as public

Every exported package-level identifier, qualified by its package:
`<package>.<Identifier>` for functions, types and variables, and
`<package>.<Type>.<Member>` for methods and fields.

- Test files, `package main`, and the `internal`, `testdata`, `vendor` and
  dot-directories are skipped.
- A nested directory with its own `go.mod` is a different module and is
  skipped.
- Paths matched by `.sdk-parse-ignore` at the SDK root (gitignore syntax) are
  skipped.
- Two walked packages sharing a name is an error, since their qualified
  symbol names would collide.

## Development

```bash
gofmt -l .
go vet ./...
go test ./...
```
