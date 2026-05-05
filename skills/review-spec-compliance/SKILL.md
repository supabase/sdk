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

**Eligibility rules (which requests retry)**
- Find the branch/condition that gates retries
- Verify the allowed methods are exactly what the spec lists — no more, no fewer

**Retryable conditions (which errors trigger retry)**
- Find where HTTP status codes and error types are checked
- Verify all listed codes trigger retry; verify unlisted codes do not

**Limits (max attempts)**
- Find the retry loop or recursion
- Count the max iterations; verify it matches the spec exactly (off-by-one is common)

**Delay / backoff**
- Find the delay computation
- Verify: base delay > 0, base delay increases between attempts, max cap is enforced
- If `Retry-After` handling is required: verify it reads the header and uses it as the delay

**Observability (headers, logs)**
- Find where outgoing request headers are set
- Verify the header name matches exactly (case-insensitive per HTTP, but check for typos)
- Verify the value computation matches the spec (retry count, not attempt count)
- Verify the header is absent on the initial attempt

**Configuration**
- Find the global config and per-request config APIs
- Verify per-request takes precedence over global (test the override path)
- Verify disabling retries causes retryable conditions to surface immediately

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
| R1.3 | MUST | ❌ Non-Compliant | AbortError not checked; all errors enter retry loop |
| R4.5 | SHOULD | ⚠️ Not Implemented | No jitter. Deliberate omission not documented. |
| R5.1 | MUST | 🔶 Partial | Header set on retries, but value is attempt count not retry count |

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
- **Off-by-one on attempt counts is a common bug** — the spec says "retry count" (retries only) vs "attempt count" (initial + retries); check both header values and loop limits
- **Per-request override is frequently missing** — always verify the precedence logic, not just that both config levels exist
- **Verify exact header names** — `X-Retry-Count` vs `x-retry-count` vs `Retry-Count` are different; HTTP header names are case-insensitive but typos still break clients that check exact strings
- **A `SHOULD` not implemented is only acceptable if the Rationale section documents why** — if it isn't documented, flag it as a gap
