# Swift Public API Parser — swift-symbolgraph-extract

**Date:** 2026-06-19  
**Status:** Design approved, pending implementation

## Problem

The current `swift-parser.ts` is a ~170-line line-by-line regex scanner with brace-depth tracking. It has known blind spots: multi-line declarations, `#if` conditional compilation blocks, attributes spanning multiple lines (e.g. `@discardableResult` + `public func` on separate lines), and cannot model Swift's full access control semantics. Root cause: regex cannot reliably parse Swift without understanding the language.

## Goal

Replace the regex parser with `swift-symbolgraph-extract` — the Swift compiler's own tool for extracting a module's public API surface — and a thin TypeScript normalizer. Same downstream interface (`ParseResult`), no changes to `check-api-symbols` or anything else.

## Decision: Semantic over Syntactic

`swift-symbolgraph-extract` uses the Swift compiler (semantic analysis), not just syntax. This gets access control right by construction: `@_spi`, `@usableFromInline`, `#if` conditional compilation, and re-exports are all resolved correctly. The cost is that `swift build` must succeed in CI. For supabase-swift this is already a CI requirement, so the extra step is nearly free.

## End-to-End Flow

**Current (regex):**
```
parse-swift <sdk-root>
  → swift-parser.ts (line-by-line regex)
  → ParseResult JSON
  → check-api-symbols
```

**Proposed (symbol graph):**
```
swift build                                         # PR branch + base branch
swift-symbolgraph-extract -module-name <M> ...      # one run per library product
  → M.symbols.json  (Symbol Graph format)
jq -s '[.[] | .symbols[]]' *.symbols.json           # merge multiple modules
  → merged-raw.json
normalize-symbolgraph <merged-raw.json>             # thin TS normalizer (new)
  → ParseResult JSON
  → check-api-symbols  (unchanged)
```

## Files Changed

**Added:**
- `src/normalize-symbolgraph.ts` — core normalizer: `SymbolGraph[]` → `ParseResult`
- `src/normalize-symbolgraph-cli.ts` — CLI entry point (`npm run normalize-symbolgraph <path>`)
- `test/normalize-symbolgraph.test.ts` — ~20 unit tests
- `test/fixtures/symbolgraph-sample.json` — real `swift-symbolgraph-extract` output (committed, not hand-authored)
- `docs/specs/2026-06-19-swift-parser-symbolgraph-design.md` — this file

**Removed:**
- `src/swift-parser.ts` — regex parser
- `src/parse-swift.ts` — CLI wrapper for regex parser
- `test/swift-parser.test.ts` — regex parser tests
- `test/fixtures/swift-sample/` — regex parser test fixtures

**Modified:**
- `.github/workflows/validate-sdk-compliance.yml` — Swift-conditional steps (see CI section)
- `package.json` — `normalize-symbolgraph` script replaces `parse-swift`

## Normalizer Design

### Input types

```typescript
interface SymbolGraphSymbol {
  kind: { identifier: string };
  accessLevel: string;
  pathComponents: string[];
  location?: { uri: string };
}

interface SymbolGraph {
  symbols: SymbolGraphSymbol[];
}
```

The normalizer accepts a merged array of all symbols (post-`jq` merge) as a single JSON file.

### Name

`pathComponents.join(".")` — the compiler already computed the qualified name. No regex needed.

Examples:
- `["SupabaseClient"]` → `"SupabaseClient"`
- `["SupabaseClient", "signIn"]` → `"SupabaseClient.signIn"`

### Kind mapping

| `kind.identifier` | `ParsedSymbol["kind"]` |
|---|---|
| `swift.class`, `swift.struct`, `swift.enum`, `swift.protocol`, `swift.actor` | `"class"` |
| `swift.func` | `"function"` |
| `swift.method`, `swift.type.method`, `swift.init`, `swift.subscript`, `swift.type.subscript` | `"method"` |
| `swift.property`, `swift.type.property`, `swift.enum.case` | `"property"` |
| `swift.typealias`, `swift.associatedtype`, `swift.var` | `"variable"` |
| `swift.deinit`, everything else | skip |

### Access filter

`swift-symbolgraph-extract` only emits `public` and `open` symbols by default. The normalizer keeps an explicit check (`accessLevel === "public" || accessLevel === "open"`) as a defensive guard.

### File path

`location.uri` is an absolute `file://` URI. The normalizer accepts the SDK root as a second CLI argument and strips the prefix to produce a relative path. Falls back to an empty string if `location` is absent (e.g. synthesized symbols).

## CI Workflow Changes

### Runner

The `check` job's runner becomes language-conditional:

```yaml
check:
  runs-on: ${{ inputs.language == 'swift' && 'macos-latest' || 'ubuntu-latest' }}
```

Swift gets `macos-latest` (Swift pre-installed via Xcode). JavaScript stays on `ubuntu-latest`. No new job.

### New Swift-conditional steps

Added after "Checkout capability spec", before the existing parse steps:

```yaml
- name: Build PR branch (Swift)
  if: inputs.language == 'swift'
  run: swift build
  working-directory: _sdk-pr

- name: Build base branch (Swift)
  if: inputs.language == 'swift'
  run: swift build
  working-directory: _sdk-base

- name: Extract symbol graphs — PR
  if: inputs.language == 'swift'
  run: |
    mkdir -p _sg-pr
    TRIPLE=$(swift -print-target-info | jq -r '.target.triple')
    SDK=$(xcrun --sdk macosx --show-sdk-path)
    for MODULE in $(swift package dump-package | jq -r '[.products[] | select(.type.library != null) | .targets[]] | unique[]'); do
      swift-symbolgraph-extract -module-name "$MODULE" \
        -target "$TRIPLE" -sdk "$SDK" \
        -I _sdk-pr/.build/debug \
        -output-dir _sg-pr
    done
    jq -s '[.[] | .symbols[]]' _sg-pr/*.symbols.json > pr-raw.json
  working-directory: _sdk-pr

- name: Extract symbol graphs — base
  if: inputs.language == 'swift'
  run: |
    mkdir -p _sg-base
    TRIPLE=$(swift -print-target-info | jq -r '.target.triple')
    SDK=$(xcrun --sdk macosx --show-sdk-path)
    for MODULE in $(swift package dump-package | jq -r '[.products[] | select(.type.library != null) | .targets[]] | unique[]'); do
      swift-symbolgraph-extract -module-name "$MODULE" \
        -target "$TRIPLE" -sdk "$SDK" \
        -I _sdk-base/.build/debug \
        -output-dir _sg-base
    done
    jq -s '[.[] | .symbols[]]' _sg-base/*.symbols.json > base-raw.json
  working-directory: _sdk-base

- name: Normalize symbol graphs — PR
  if: inputs.language == 'swift'
  run: |
    npm run --silent normalize-symbolgraph -- \
      "$GITHUB_WORKSPACE/pr-raw.json" "$GITHUB_WORKSPACE/_sdk-pr" \
      > "$GITHUB_WORKSPACE/pr-symbols.json"
  working-directory: _sdk-spec/scripts/capability-matrix

- name: Normalize symbol graphs — base
  if: inputs.language == 'swift'
  run: |
    npm run --silent normalize-symbolgraph -- \
      "$GITHUB_WORKSPACE/base-raw.json" "$GITHUB_WORKSPACE/_sdk-base" \
      > "$GITHUB_WORKSPACE/base-symbols.json"
  working-directory: _sdk-spec/scripts/capability-matrix
```

### Modified existing steps

The three existing steps — "Resolve parse command", "Parse PR branch", "Parse base branch" — are each guarded with `if: inputs.language != 'swift'`. For Swift, the dedicated build → extract → normalize steps above already produce `pr-symbols.json` and `base-symbols.json` directly. The final "Check new symbols against capability matrix" step (`check-api-symbols`) runs unconditionally and is unchanged.

### SPM dependency caching

Add `actions/cache` on `~/.cache/org.swift.swiftpm` keyed on `Package.resolved` to avoid re-downloading SPM dependencies on repeated runs.

## Testing

**Fixture** (`test/fixtures/symbolgraph-sample.json`): real merged symbol graph output from a small Swift package or subset of supabase-swift. Generated once with the actual tool, committed, never hand-authored.

**Test cases** (~20 tests in `test/normalize-symbolgraph.test.ts`):

| Case | What it verifies |
|---|---|
| `public class` | type → `"class"`, pathComponents join |
| `public struct` | type → `"class"` |
| `public enum` + cases | type → `"class"`, cases → `"property"` |
| `public protocol` | type → `"class"` |
| `public actor` | type → `"class"` |
| `open class` | `open` access level included |
| `internal` symbol | filtered out |
| Instance method | → `"method"` |
| Static method (`swift.type.method`) | → `"method"` |
| `init` | → `"method"` |
| Instance property | → `"property"` |
| Global free function | → `"function"` |
| Typealias | → `"variable"` |
| `deinit` | skipped |
| Nested type (`Outer.Inner`) | pathComponents → `"Outer.Inner"` |
| Multi-module merge | symbols from two inputs appear in output |
| `file` path | absolute URI → relative path |
| Missing `location` | file falls back to `""` |

No Swift toolchain needed at test time — the normalizer is pure TypeScript operating on JSON.
