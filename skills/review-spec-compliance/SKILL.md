---
name: review-spec-compliance
description: Reviews an SDK implementation against a Supabase SDK behavior specification. Extracts every MUST/MUST NOT/SHOULD requirement from the spec, traces each one to the implementation code, and produces a compliance matrix. Use when asked to check if an SDK implementation is compliant with a spec, whether a spec is implemented correctly, or which requirements are missing from an implementation.
---

# Spec Compliance Review

## Process

Work spec-first, not code-first. The spec is the contract; the code must conform to it.

1. **Parse the spec** — extract every normative requirement into a working list
2. **Locate the implementation** — find the relevant code for the behavior described by the spec
3. **Trace each requirement** — for each MUST/MUST NOT/SHOULD, find the code that satisfies it (or doesn't)
4. **Map scenarios to tests** — check whether each scenario has a corresponding test
5. **Produce the compliance matrix**

## Step 1: Extract Requirements

Read the spec's Requirements section. For each item, record:

| Field | What to capture |
|-------|----------------|
| ID | `R1.1`, `R2.3`, etc. |
| Strength | `MUST` / `MUST NOT` / `SHOULD` / `SHOULD NOT` / `MAY` |
| Behavior | One-sentence summary of what must be true |
| Observable signal | What in the code/output would prove or disprove it |

Do not skip `SHOULD` requirements. Non-compliance with a `SHOULD` must be documented, even if it isn't blocking.

## Step 2: Locate the Implementation

Before reading any code, identify:
- Which file(s) contain the behavior described by the spec (look for the feature name, HTTP method handling, header names, config keys from the spec)
- Which test files cover this behavior
- Whether there is a conformance test suite or just unit tests

## Step 3: Trace Each Requirement

For each requirement, do one of:

**Compliant** — cite the exact file, function, and line that implements it. One quote or reference is enough.

**Non-Compliant** — the behavior is absent or wrong. Describe what the code does instead.

**Partial** — the behavior is present but incomplete (e.g. MUST applies to three cases; code handles two).

**Untested** — the code path exists but no test exercises it. Flag for the scenarios check too.

**Cannot Determine** — the code is too abstracted or relies on a platform detail you cannot verify. Note what would need to be checked.

### What to look for per requirement type

Derive the categories from the spec's own Requirements sections — each `R{N}` group maps to one category. The guidance below covers the types that appear most commonly across SDK behavior specs.

**Eligibility / trigger conditions** (e.g. R1 — Eligibility)
- Find the branch or predicate that gates the behavior
- Verify the allowed inputs are exactly what the spec lists — no more, no fewer
- Verify excluded inputs are rejected immediately without entering the behavior

**Trigger conditions** (e.g. R2 — which states or responses activate the path)
- Find where the triggering states are checked
- Verify all listed conditions activate the path; verify unlisted conditions do not

**Limits** (e.g. R3 — max attempts, max connections, timeouts)
- Find the code that enforces the limit
- Verify the limit matches the spec exactly — off-by-one is common, especially when the spec distinguishes total count from incremental count

**Computed values** (e.g. R4 — delay formula, backoff, expiry)
- Find the computation
- Verify every constraint the spec imposes (minimum, growth, maximum cap)
- If the spec requires reading a signal from an external source (header, token field, config value), verify the code reads the correct key and uses it as the spec describes

**Observability** (e.g. R5 — headers, events, signals)
- Find where outgoing headers or signals are set
- Verify names match the spec exactly — case matters for string comparisons even when HTTP headers are case-insensitive
- Verify values match the spec's definition, paying attention to whether the spec counts from zero or one, and whether it counts total occurrences or incremental ones

**Configuration** (e.g. R6 — global vs scoped settings)
- Find both the global config and the scoped (per-request / per-call) config APIs
- Verify scoped config takes precedence over global (the override path is frequently untested)
- Verify that disabling the behavior causes triggering conditions to surface immediately

## Step 4: Map Scenarios to Tests

The spec's Scenarios section lists named test cases. For each scenario:
- Search the test suite for a test that covers the same stimulus/expected pair
- A test covers a scenario if it exercises the same conditions and verifies the same observable outcome
- Partial coverage (right stimulus, wrong assertion) counts as untested

## Step 5: Produce the Compliance Matrix

```
## Spec Compliance Review: NNNN-<topic>.md
Implementation: <path/to/implementation>

### Compliance Matrix

| Req | Strength | Status | Evidence / Gap |
|-----|----------|--------|----------------|
| R1.1 | MUST | ✅ Compliant | `retry.ts:42` — method allowlist `['GET','HEAD','OPTIONS']` |
| R1.2 | MUST | ✅ Compliant | `retry.ts:38` — `retryEnabled` defaults to `true` |
| R1.3 | MUST | ❌ Non-Compliant | Caller cancellation not checked; all errors enter retry loop |
| R4.3 | MUST | ❌ Non-Compliant | No cap enforced; delay can exceed 30 s on slow networks |
| R5.1 | MUST | 🔶 Partial | Header set on retries, but value is total attempt count not retry count |

### Scenario Coverage

| Scenario | Status | Test location |
|----------|--------|---------------|
| `retry-get-520` | ✅ Covered | `retry.test.ts:88` |
| `no-retry-abort` | ❌ Missing | No test found |
| `delay-increases` | 🔶 Partial | Test exists but doesn't assert delay ordering |

### Summary
- MUST/MUST NOT: N compliant, N non-compliant, N partial
- SHOULD/SHOULD NOT: N implemented, N not implemented
- Scenarios: N covered, N missing, N partial

### Critical Gaps
[List only MUST/MUST NOT failures and SHOULD gaps without documented rationale]

### Recommendations
[Only if asked. Otherwise: surface findings, don't prescribe fixes.]
```

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Compliant — requirement is fully satisfied |
| ❌ | Non-Compliant — requirement is absent or violated |
| 🔶 | Partial — partially satisfied; describe the gap |
| ⚠️ | SHOULD not implemented — not a conformance failure but should be documented |
| ❓ | Cannot Determine — needs platform-level verification |

## Rules

- **Never infer compliance from test names alone** — read the test body to verify the assertion matches the spec's Expected
- **Off-by-one on counts is a common bug** — whenever the spec defines a count, confirm whether it is ordinal (1st, 2nd, Nth occurrence) or cumulative (N total); verify the implementation uses the same definition and check both the limit enforcement and any observable value derived from that count
- **Scoped config overrides are frequently missing** — when the spec defines both global and per-request configuration, always verify the precedence logic, not just that both config levels exist
- **Verify exact field and header names** — `My-Header` vs `my-header` are equivalent by HTTP spec but typos still break string comparisons; verify names character-for-character against the spec
- **A `SHOULD` not implemented is only acceptable if the spec's Rationale section documents why** — if it isn't documented, flag it as a gap
