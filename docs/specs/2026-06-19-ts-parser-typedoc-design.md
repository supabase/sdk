# TypeScript Public API Parser: typedoc Refactor

**Date:** 2026-06-19
**Status:** Approved

## Problem

`ts-parser.ts` walks individual TypeScript source files using the TypeScript compiler API in syntactic-only mode. It correctly handles top-level `class`, `function`, and `variable` declarations but misses:

- `interface` and `type` alias declarations
- `enum` declarations and members
- Re-exports (`export * from`, `export { foo } from`)
- Namespace merging and declaration merging
- Symbols only accessible via the package's `exports` field

This creates false negatives: new public symbols added to the supabase-js SDK may not be caught by the compliance check because the parser cannot see them.

There is also an architectural inconsistency. PR #35 established the pattern of using an external, well-maintained language tool (dartdoc_json) to generate structured JSON, then normalizing that output into `ParseResult`. The TypeScript path should follow the same shape.

## Solution

Replace `ts-parser.ts` and `parse-ts.ts` with a thin normalizer (`normalize-typedoc.ts`) over [TypeDoc](https://typedoc.org/) JSON output. TypeDoc runs the full TypeScript compiler internally and handles all of the cases the current parser misses. The `check-api-symbols` interface and everything downstream are unchanged.

## End-to-End Flow

```
supabase-js PR
  → validate-sdk-compliance.yml
      [ts-only]  npm ci  (in SDK repo)
      [ts-only]  npx typedoc@0.27 --json pr-raw.json --excludePrivate --excludeProtected <entrypoint>
      [ts-only]  git checkout base; npm ci; npx typedoc@0.27 --json base-raw.json …
      → normalize-typedoc pr-raw.json   → pr-symbols.json
      → normalize-typedoc base-raw.json → base-symbols.json
      → check-api-symbols pr-symbols.json base-symbols.json sdk-compliance.yaml
```

## Files Changed

### Added
- `scripts/capability-matrix/src/normalize-typedoc.ts` — core normalizer
- `scripts/capability-matrix/src/normalize-typedoc-cli.ts` — CLI entry point
- `scripts/capability-matrix/test/normalize-typedoc.test.ts` — ~15 fixture-based unit tests
- `scripts/capability-matrix/test/fixtures/typedoc-sample.json` — real TypeDoc 0.27 output

### Deleted
- `scripts/capability-matrix/src/ts-parser.ts`
- `scripts/capability-matrix/src/parse-ts.ts`
- `scripts/capability-matrix/test/ts-parser.test.ts`
- `scripts/capability-matrix/test/fixtures/ts-sample/`

### Modified
- `.github/workflows/validate-sdk-compliance.yml` — replace `parse-ts` steps with TypeDoc steps; add `entrypoint` input
- `scripts/capability-matrix/package.json` — `normalize-typedoc` script replaces `parse-ts`

## Normalizer Design

TypeDoc JSON is a tree of "reflections", each with a numeric `kind`. The normalizer walks two levels: top-level declarations and their members for class-like types.

### Tree traversal

With `--entryPointStrategy resolve`, TypeDoc wraps each entrypoint's declarations inside a `Module` reflection (kind 2) rather than placing them directly under the project root. The normalizer flattens one level: it walks `project.children`, and for any child with kind `Module` (2) or `Namespace` (4) it recurses into that child's `children` to find declarations. Namespaces are not emitted as symbols themselves — only their members are.

### Top-level kind mapping

| TypeDoc kind | Numeric value | Emitted `ParsedSymbol.kind` | Notes |
|---|---|---|---|
| Class | 128 | `"class"` | walk members |
| Interface | 256 | `"class"` | treated same as class |
| Enum | 8 | `"class"` | walk members |
| Function | 64 | `"function"` | |
| Variable | 32 | `"variable"` | |
| TypeAlias | 2097152 | `"variable"` | exported types worth tracking |
| Reference | 4194304 | skip | re-export pointer; canonical declaration already emitted |

### Member kind mapping (inside Class / Interface / Enum)

| TypeDoc kind | Numeric value | Emitted `ParsedSymbol.kind` |
|---|---|---|
| Method | 2048 | `"method"` with `ClassName.name` |
| Property | 1024 | `"property"` with `ClassName.name` |
| Accessor | 262144 | `"method"` (getter/setter) |
| Constructor | 512 | skip |
| EnumMember | 16 | `"property"` with `EnumName.MemberName` |

### Privacy

TypeDoc is invoked with `--excludePrivate --excludeProtected`, so private and protected members are stripped before the JSON is written. The normalizer also defensively skips any member where `flags.isPrivate` or `flags.isProtected` is `true`, in case the tool is ever called without those flags.

### File path

`ParsedSymbol.file` is populated from `sources[0].fileName` on each reflection (e.g. `src/auth/client.ts`).

### Normalizer public interface

```typescript
export function normalize(json: unknown): ParseResult
```

A single function. The CLI wrapper reads the input file, calls `normalize`, and writes the output file.

## CI Workflow Changes

New `entrypoint` input on `validate-sdk-compliance.yml` (default: `src/index.ts`). SDK repos that have a non-standard entrypoint pass this explicitly; most do not need to change.

TypeDoc is pinned at `0.27` and invoked via `npx --yes typedoc@0.27` — no changes needed to the SDK's `package.json`.

The `language: javascript` input value is unchanged; SDK repos that already call this workflow need no modifications.

## Testing

The fixture (`typedoc-sample.json`) is generated from a minimal TypeScript project that exercises all mapped cases. It is committed to the repo so tests are hermetic and do not require a TypeScript build at test time.

Test coverage (~15 cases):

| Case | Assertion |
|---|---|
| Class | emits `"class"` kind |
| Class methods | `ClassName.method` as `"method"` |
| Class property | `ClassName.prop` as `"property"` |
| Accessor | getter/setter as `"method"` |
| Constructor | not emitted |
| Interface | emitted as `"class"` |
| Interface members | same rules as class members |
| Enum | emitted as `"class"` |
| EnumMember | `EnumName.Member` as `"property"` |
| Exported function | `"function"` kind |
| Exported variable | `"variable"` kind |
| TypeAlias | `"variable"` kind |
| Reference (re-export) | not emitted |
| File path | taken from `sources[0].fileName` |
| Defensive privacy | member with `flags.isPrivate: true` not emitted |
