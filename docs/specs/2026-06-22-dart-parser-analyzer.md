# Dart API Surface Parser — package:analyzer tool

**Date:** 2026-06-22
**Status:** Proposed
**Context:** [supabase/sdk#35](https://github.com/supabase/sdk/pull/35) wires up Dart support using [`dartdoc_json`](https://pub.dev/packages/dartdoc_json) plus a Node.js normalizer. This spec is an alternative implementation that uses `package:analyzer` directly through a small Dart tool, removing the third-party CLI, the `jq` merge, and the Node normalizer.

---

## Problem

The capability matrix gates SDK PRs by extracting the public API surface of each package and comparing it against `sdk-compliance.yaml`. TypeScript and Swift already have parsers that emit a shared `ParseResult` shape. Dart needs the same.

`dartdoc_json` works, but it has costs:

- It is a third-party CLI (last published ~18 months ago) that must be `dart pub global activate`d in CI.
- `dartdoc_json` 0.5.0 throws on `extension type` declarations (Dart 3.3+), so the pipeline relies on supabase-flutter never using one in its public API.
- The pipeline is multi-stage: `dartdoc_json` per package → `flutter pub get` per package → `jq -s` merge → Node normalizer → `check-api-symbols`.
- The Dart path bypasses `.sdk-parse-ignore`, which the TypeScript and Swift parsers honor.

---

## Solution

A small Dart tool (`dart_symbol_extractor`) that uses `package:analyzer` to parse each package's `lib/**.dart` files **syntactically** and emit the existing `ParseResult` shape directly.

Syntactic parsing (`parseString`, no element resolution) means:

- No `pub get` on the target packages, no network, no resolvable dependency graph required — only the Dart SDK and the tool's own dependencies.
- The real analyzer front end, so extension types, enhanced enums, mixins, and named extensions all parse correctly by construction.

It is invoked exactly like the other parsers, via an npm script, so the reusable workflow's generic parse step is unchanged.

---

## Architecture

```
supabase-flutter PR
  → validate-sdk-compliance.yml
      [dart-only] install Dart SDK (direct download, no marketplace action)
      [dart-only] dart pub get   (in dart_symbol_extractor/)
      → npm run parse-dart -- <sdk-root>     # PR branch  → pr-symbols.json
      → npm run parse-dart -- <sdk-root>     # base branch → base-symbols.json
      → check-api-symbols pr-symbols.json base-symbols.json sdk-compliance.yaml
```

Compared with the `dartdoc_json` pipeline this drops: the global tool activation, the per-package `flutter pub get`, the per-package JSON files, the `jq` merge, and the Node normalizer.

### Files

- `scripts/capability-matrix/dart_symbol_extractor/` — the Dart tool
  - `lib/src/extractor.dart` — `extractFromSource(source, relPath)` and `parseDartProject(root)`
  - `lib/src/parsed_symbol.dart` — `ParsedSymbol` model and JSON serialization
  - `lib/src/ignore_matcher.dart` — gitignore-style matcher for `.sdk-parse-ignore`
  - `bin/extract.dart` — CLI entry point; prints `{ "symbols": [...] }`
  - `test/` — unit tests plus a fixture package exercising discovery and ignores
- `scripts/capability-matrix/package.json` — adds the `parse-dart` script
- `.github/workflows/validate-sdk-compliance.yml` — adds the `dart` case plus two dart-only setup steps. The Dart SDK is installed by a plain download rather than a marketplace action, so the reusable workflow does not depend on each calling repo's allowed-actions policy

---

## Symbol model

The tool matches the mapping the other parsers and the `dartdoc_json` normalizer use, so it is a drop-in replacement at the `ParseResult` boundary:

| Dart declaration | Emitted symbol | kind |
| --- | --- | --- |
| class / mixin / enum / extension type | `Name` | `class` |
| named extension | `Name` | `class` |
| method / operator | `Owner.method` | `method` |
| getter / setter / field | `Owner.member` | `property` |
| constructor (unnamed) | `Owner.Owner` | `method` |
| constructor (named) | `Owner.named` | `method` |
| top-level function | `name` | `function` |
| top-level variable / typedef | `name` | `variable` |

Privacy follows Dart's name rule: any declaration or member whose name starts with `_` is excluded. Enum constants are not emitted (matching the `dartdoc_json` normalizer). Unnamed extensions are skipped because their members cannot be qualified.

### Discovery and exclusions

- Discovers every package (a directory with `pubspec.yaml` and a `lib/`) beneath the given root.
- Skips hidden directories, `build/`, and generated sources (`*.g.dart`, `*.freezed.dart`, `*.gr.dart`).
- Honors `.sdk-parse-ignore` (gitignore subset: comments, negation, directory patterns, `*`/`**`/`?` globs), unlike the `dartdoc_json` path. Consumer repos should list `example`/`examples` directories there to keep sample apps out of the surface.

---

## Trade-offs vs `dartdoc_json`

**For this approach**

- No third-party CLI; the tool is owned in-repo and pinned via `pubspec.lock`.
- Handles extension types instead of crashing on them.
- Single Dart step; removes the Node normalizer, the `jq` merge, and per-package `pub get`.
- Honors `.sdk-parse-ignore` for parity with the other parsers.

**Against**

- Adds a Dart package (and the Dart SDK setup step) to a primarily Node toolchain.
- The `.sdk-parse-ignore` matcher reimplements a documented subset of gitignore rather than reusing the npm `ignore` package the TypeScript/Swift parsers use.
- Like every parser here, it is syntactic and per-file: it does not resolve `export` directives, so a public-named declaration in `lib/src` counts even if it is never exported. This matches the existing parsers' altitude.

---

## Test plan

- [x] `dart test` — unit tests for the symbol model (classes, members, constructors, getters/setters, enhanced enums, mixins, named extensions, extension types, top-level declarations, privacy) and the ignore matcher, plus a fixture-package integration test for discovery, generated-file and example exclusion, and relative paths.
- [x] `dart analyze` clean.
- [x] E2E: run against a local checkout of supabase-flutter and confirm the expected public surface (e.g. `SupabaseClient` and its members) is captured.
