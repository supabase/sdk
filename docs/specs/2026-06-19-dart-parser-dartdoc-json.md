# Dart API Surface Parser — switch to dartdoc_json

**Date:** 2026-06-19
**Status:** Approved
**Context:** [supabase/sdk#35](https://github.com/supabase/sdk/pull/35) introduced a handrolled regex-based Dart parser. Reviewer @spydon suggested using `dartdoc_json` instead for correctness. This spec replaces the handrolled approach.

---

## Problem

The handrolled `dart-parser.ts` uses line-by-line regex to extract public symbols. Known gaps:

- `extension type` (Dart 3.3+) silently ignored
- `/* */` block comments with unbalanced braces corrupt depth tracking
- Class with opening brace on its own line loses all members
- Required two production bug fixes (annotation lines, arrow-function continuations) before the first real use

The root cause is that regex cannot reliably parse Dart without understanding the language. The right tool is the Dart analyzer itself.

---

## Solution

Use [`dartdoc_json`](https://pub.dev/packages/dartdoc_json) — a Dart CLI tool that runs the real Dart analyzer and outputs a structured JSON list of all public API members. A thin Node.js normalizer maps that output to the existing `ParseResult` shape consumed by `check-api-symbols`.

---

## Architecture

```
supabase-flutter PR
  → validate-sdk-compliance.yml (reusable, in supabase/sdk)
      [conditional on language == dart]
      → setup Dart SDK + activate dartdoc_json
      → per package: dart pub get + dartdoc_json → raw JSON
      → jq concat all package JSONs → merged raw file
      → normalize-dartdoc.ts → pr-symbols.json / base-symbols.json
      [always]
      → check-api-symbols pr-symbols.json base-symbols.json sdk-compliance.yaml
```

The `check-api-symbols` step and everything downstream is unchanged. The calling workflow in supabase-flutter is unchanged.

---

## Changes

### Deleted
- `scripts/capability-matrix/src/dart-parser.ts`
- `scripts/capability-matrix/src/parse-dart.ts`
- `scripts/capability-matrix/test/dart-parser.test.ts`
- `scripts/capability-matrix/test/fixtures/dart-sample/`

### Added
- `scripts/capability-matrix/src/normalize-dartdoc.ts` — reads merged dartdoc_json output, emits `ParseResult`
- `scripts/capability-matrix/src/normalize-dartdoc-cli.ts` — CLI entry point (`normalize-dartdoc` npm script)
- `scripts/capability-matrix/test/normalize-dartdoc.test.ts` — tests against real dartdoc_json fixture output
- `scripts/capability-matrix/test/fixtures/dartdoc-sample.json` — captured dartdoc_json output used as test fixture

### Modified
- `scripts/capability-matrix/package.json` — replace `parse-dart` with `normalize-dartdoc`
- `.github/workflows/validate-sdk-compliance.yml` — add Dart-conditional steps to `check` job

---

## CI workflow (`validate-sdk-compliance.yml`)

New steps in the `check` job, all conditional on `inputs.language == 'dart'`, inserted after "Install dependencies":

```yaml
- name: Setup Dart SDK
  if: inputs.language == 'dart'
  uses: dart-lang/setup-dart@v1

- name: Activate dartdoc_json
  if: inputs.language == 'dart'
  run: dart pub global activate dartdoc_json

- name: Generate Dart API surface (PR branch)
  if: inputs.language == 'dart'
  run: |
    find "$GITHUB_WORKSPACE/_sdk-pr" -name pubspec.yaml \
      -not -path "*/.*" -not -path "*/build/*" \
      | while read pubspec; do
          pkg=$(dirname "$pubspec")
          dart pub get --directory "$pkg"
          dartdoc_json $(find "$pkg/lib" -name "*.dart" -not -name "*.g.dart") \
            --root "$pkg" --output "$pkg/api.json"
        done
    jq -s '[.[][]]' $(find "$GITHUB_WORKSPACE/_sdk-pr" -name api.json) \
      > "$GITHUB_WORKSPACE/pr-raw.json"
  env:
    PUB_CACHE: /tmp/pub-cache

- name: Generate Dart API surface (base branch)
  if: inputs.language == 'dart'
  # identical, substituting _sdk-base and base-raw.json
```

The "Resolve parse command" step maps `dart` → `normalize-dartdoc`. The "Parse PR/base branch" steps pass the raw JSON file path (not the source path) when language is dart:

```yaml
- name: Parse PR branch
  run: |
    if [ "${{ inputs.language }}" = "dart" ]; then
      npm run --silent normalize-dartdoc -- "$GITHUB_WORKSPACE/pr-raw.json" \
        > "$GITHUB_WORKSPACE/pr-symbols.json"
    else
      npm run --silent ${{ steps.resolve.outputs.cmd }} -- "$GITHUB_WORKSPACE/_sdk-pr" \
        > "$GITHUB_WORKSPACE/pr-symbols.json"
    fi
  working-directory: _sdk-spec/scripts/capability-matrix
```

---

## `normalize-dartdoc.ts`

Reads the merged dartdoc_json output (array of compilation units) and emits `ParseResult`.

**Mapping:**

| dartdoc_json kind | ParsedSymbol kind |
|---|---|
| `class`, `mixin`, `enum`, `extension type` | `"class"` |
| `function` (top-level) | `"function"` |
| `typedef`, `variable` (top-level) | `"variable"` |
| `method`, `constructor` (member) | `"method"` |
| `getter`, `setter`, `field` (member) | `"property"` |

**Symbol naming:**
- Top-level: `name` as-is
- Class member: `ClassName.memberName`
- Named constructor: `ClassName.constructorName`
- Default constructor: `ClassName.ClassName` (consistent with existing convention)

**Filtering:**
- Skip any symbol whose name starts with `_`
- `sdk-parse-ignore` support is dropped — dartdoc_json respects Dart's own visibility rules, making manual exclusion unnecessary

**First implementation step:** Run `dartdoc_json` against the real supabase-flutter repo and inspect the actual JSON field names and kind strings before writing the normalizer. Use the captured output as the test fixture.

---

## Tests (`normalize-dartdoc.test.ts`)

Fixture: `test/fixtures/dartdoc-sample.json` — real dartdoc_json output captured from a small Dart package (or the dart-sample fixture rebuilt as a real Dart package).

Test cases:
- Public class with methods, getters, setters → correct symbols emitted
- Private members (`_`-prefixed) → excluded
- Top-level functions and typedefs → correct kinds
- Named and default constructors → correct naming
- Multiple compilation units → flat symbol list
- Empty declarations → no crash

---

## What is NOT changing

- `ts-parser.ts`, `swift-parser.ts` — unchanged
- `check-api-symbols.ts`, `compliance.ts`, `aggregate.ts` — unchanged
- `sdk-compliance.yaml` in supabase-flutter — unchanged
- `validate-capabilities.yml` in supabase-flutter — unchanged
- The `validate` job in `validate-sdk-compliance.yml` — unchanged
