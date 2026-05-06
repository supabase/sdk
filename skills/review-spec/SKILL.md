---
name: review-spec
description: Reviews a Supabase SDK behavior specification for internal consistency and structural correctness. Checks section structure, RFC 2119 language usage, scenario format, requirement numbering, version/changelog alignment, and cross-section consistency. Use when asked to review, audit, or check an SDK spec file (specs/NNNN-*.md) for consistency, correctness, or completeness.
---

# SDK Spec Consistency Review

## Process

1. Read the full spec before flagging anything
2. Build an internal index: all requirement IDs, all defined terms, all scenario slugs, all RFC 2119 keywords used
3. Run all checks below
4. Report findings grouped by severity

## Structural Checks

### Section presence and order
The spec MUST have exactly these seven sections in this order:
1. Header table
2. Abstract
3. Definitions
4. Requirements
5. Scenarios
6. Rationale
7. Changelog

Flag: missing sections, merged sections, extra sections, wrong order.

### Header table
- `Version` follows semver (`0.1.0` format)
- `Status` is one of: `Draft`, `Review`, `Stable`, `Deprecated`
- `Date` is a real date in `YYYY-MM-DD` format
- `References` includes the RFC 2119 link

### File naming
- Format: `NNNN-<topic>.md` (4-digit zero-padded number, lowercase hyphenated topic)
- Topic describes the behavior, not the library (e.g. `postgrest-retry`, not `supabase-js-retry`)
- No `-spec` suffix, no date prefix

## Definitions Checks

- RFC 2119 boilerplate MUST appear verbatim before any term table
- Every term used normatively in Requirements MUST be defined here
- Flag terms used in Requirements that are not in the Definitions table
- Flag defined terms never used in Requirements (dead definitions)

## Requirements Checks

### Numbering consistency
- Groups: `R1`, `R2`, etc. — each group covers a distinct concern
- Items: `R1.1`, `R1.2`, etc. — sequential, no gaps
- Flag: duplicate IDs, gaps in numbering, items in wrong group

### RFC 2119 word usage
| Word | Correct use |
|------|-------------|
| `MUST` / `MUST NOT` | Absolute — conformance breaks without it |
| `SHOULD` / `SHOULD NOT` | Strong recommendation — deviation needs justification |
| `MAY` | Optional |

Flag:
- RFC 2119 words used in lowercase (`must`, `should`) — they lose normative force
- `MUST` used where behavior is clearly optional (should be `MAY`)
- `SHOULD` used where the spec treats it as absolute (should be `MUST`)
- Implementation details (internal timers, data structures, loop logic) — requirements describe behavior only
- Platform-specific error type names (e.g. `AbortError`, `NetworkError`, `CancellationException`) — requirements must use abstract terms defined in Definitions
- Unit-conversion instructions (e.g. "in seconds, converted to milliseconds") — state the semantic meaning; conversion is an implementation concern
- `SHOULD` requirements for behaviors where every SDK cell in `README.md` shows ⬜ (not started) — flag for confirmation that the behavior is intentional and not a best-practice insertion

### Every SHOULD needs a Rationale entry
Flag any `SHOULD` requirement that has no corresponding entry in the Rationale section. This is a **Warning**: it does not break conformance, but without a rationale entry a reviewer cannot tell whether an implementation's deviation is justified.

## Scenarios Checks

### Format
Each scenario must have:
- A named slug (e.g. `retry-get-520`) as a code-formatted heading
- One sentence describing the situation
- `**Stimulus**:` line
- `**Expected**:` line

Flag:
- `TC-01` / `TC-02` style numbering — must use named slugs
- Given/When/Then format — must use Stimulus/Expected
- Vague expected outcomes ("succeeds", "fails") — must state what caller receives
- Implementation assertions in Expected ("timer fires", "counter increments") — only observable behavior
- Stimulus written as prose (e.g. "four total attempts") instead of a `→`-separated sequence — every scenario must have the full explicit chain
- Description that counts events differently from the Stimulus chain (e.g. "three times" when the stimulus shows four) — check description against chain
- Platform-specific error names in Stimulus or Expected (e.g. `AbortError`, `NetworkError`) — use the abstract term from Definitions

### Slug naming conventions
- Descriptive, hyphenated, lowercase — derived from the behavior being tested
- Examples from a retry-type spec: `retry-get-520`, `no-retry-post-520`, `no-retry-abort`
- Flag slugs that use generic numbering (`tc-01`) or opaque abbreviations

### Coverage
- Every distinct behavioral claim in Requirements SHOULD have at least one scenario
- Flag requirements with no corresponding scenario

### Cross-spec overlap
If behavior depends on another spec, the requirement must be self-contained here — not deferred with "see spec NNNN for R3.x". Flag cross-spec references in normative text.

## Rationale Checks

- Non-normative: flag if rationale text contains `MUST`, `SHOULD`, `MAY`
- Format: bold question → answer paragraph
- Every `SHOULD` requirement needs a rationale entry explaining when deviation is acceptable
- Every non-obvious limit and every explicit exclusion needs a rationale entry
- Flag missing rationale for `SHOULD` requirements
- Flag numerical claims (worst-case times, sums, totals) that cannot be independently verified from the information given in the spec — ask the author to show the computation

## Changelog Checks

- Table columns: `Version`, `Date`, `Description`
- Version in latest entry MUST match version in header table
- Dates MUST be `YYYY-MM-DD`
- Every version bump MUST have a changelog entry
- Entries MUST NOT be removed (history is permanent)
- Flag: version/changelog mismatch, missing entries for apparent changes, malformed dates

## Terminology Consistency

Build a glossary from the Definitions section, then check:
- Same concept referred to by different names across sections (e.g. "attempt" in Requirements vs "request" in Scenarios)
- Same name used for different concepts
- Config option names that vary between Requirements and Scenarios (e.g. `retry` vs `autoRetry` vs `retryEnabled`)
- RFC 2119 keywords capitalized in Requirements but not in Abstract/Rationale (acceptable) vs lowercase in normative Requirements (flag)

## Output Format

```
## Spec Consistency Review: NNNN-<topic>.md

### Critical — Must Fix
[Issues that break conformance, cause implementation divergence, or violate mandatory structure]
- **[Section]: [Requirement ID or slug]**: <exact quote> — <description of problem>

### Warnings — Should Fix
[Ambiguities, missing rationale, weak scenario coverage]
- **Terminology**: "attempt" and "request" used interchangeably in R2.1 and scenario `retry-get-520`

### Suggestions — Consider Fixing
[Minor polish, naming conventions, non-blocking gaps]
- **Scenario coverage**: R3.4 has no corresponding scenario

### Glossary Conflicts
| Term | Usage 1 (location) | Usage 2 (location) |
|------|--------------------|--------------------|

### Summary
N critical, N warnings, N suggestions
```

## Tips

- Quote the exact text when flagging a contradiction — don't paraphrase
- Reference section names and requirement IDs precisely (e.g. "R2.3 in Requirements vs scenario `no-retry-abort` in Scenarios")
- If something is ambiguous but not definitively wrong, mark Warning not Critical
- Don't suggest rewrites unless asked — surface the inconsistency only
