# dart_symbol_extractor

Extracts the public API surface of Dart and Flutter packages as JSON, in the
`ParsedSymbol` shape the capability-matrix scripts consume. The Dart
compliance workflow (`validate-sdk-compliance-dart.yml`) runs it on the pull
request and, in `additions` mode, on the base branch to find newly added public
symbols that no `sdk-compliance.yaml` entry lists.

## Usage

```bash
cd packages/dart-symbol-extractor
dart pub get
dart run bin/extract.dart <path-to-sdk-root>
```

The JSON dump goes to stdout, sorted by name.

Each symbol has a `name`, a `kind`, a `file` and a `line`. `kind` is one of
`class`, `method`, `property`, `function` or `variable`. Files that fail to
parse are skipped with a warning on stderr, and any other failure exits with
status 1.

## What counts as public

- Every `pubspec.yaml` under the root with a `lib/` directory is a package,
  and every `.dart` file under its `lib/` is read. Directories starting with
  `.` and `build` directories are skipped.
- A declaration is public when its name does not start with `_`.
- Declarations annotated with `@internal` from `package:meta` are excluded.
- Generated files (`.g.dart`, `.freezed.dart`, `.gr.dart`) are skipped.
- Paths matched by `.sdk-parse-ignore` at the SDK root (gitignore syntax) are
  skipped.

Parsing is purely syntactic, so the target packages need no `pub get`. Exports
are not followed: each file is collected on its own.

## Development

```bash
dart format --output=none --set-exit-if-changed .
dart analyze
dart test
```
