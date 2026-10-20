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

Each symbol has a `name`, a `kind`, a `file` and a `line`. `kind` is one of
`class`, `method`, `property`, `function` or `variable`. Files that fail to
parse are skipped with a warning on stderr, and any other failure exits with
status 1.

## Which modules are read

The published modules are the `use` directives of the `go.work` file at the
SDK root. Repositories without one name their module directories with
repeated `-module` flags, which override `go.work` discovery.

## What counts as public

Every exported package-level identifier, qualified by its package's
directory path relative to the SDK root: `auth.Admin` for a module-root
package, `auth/customprovider.Builder` for a nested package and
`auth/customprovider.Builder.OIDC` for methods and fields. A module rooted
at the SDK root itself (reachable only through `-module .`) has no directory
to speak of, so its package name is the qualifier.

- Test files, `package main`, and the `internal`, `testdata`, `vendor` and
  dot-directories are skipped.
- A nested directory with its own `go.mod` is a different module and is
  skipped.
- Paths matched by `.sdk-parse-ignore` at the SDK root (gitignore syntax) are
  skipped.
- A package whose name is not its directory's base name fails the
  extraction, since its path-derived qualifier would misname it. This also
  holds every module-root package to its module directory's name.

## Versioning

This extractor has no version of its own: no tag family, no entry in
`release-please-config.json` and no published module version. Consumers
resolve it structurally instead. The `validate-sdk-compliance-go.yml`
reusable workflow checks out this repository at the single commit the
calling repository pinned, and runs the extractor from that tree, so the
extractor, the composite actions and the capability spec always travel
together at one SHA. The `capability-matrix/vX.Y.Z` release tags are the
human-readable names for those states, so a change here reaches a tagged
release with the next capability-matrix release, and a change that alters
the symbol spelling updates the format documentation in
`packages/capability-matrix/docs/capability-matrix.md` in the same commit.

## Development

```bash
gofmt -l .
go vet ./...
go test ./...
```
