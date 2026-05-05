---
name: sdk-spec
description: Use when creating a new SDK behavior specification, updating an existing spec, or reviewing a spec for completeness and consistency. Covers file naming, document structure, RFC 2119 requirement language, scenario format, status lifecycle, and changelog maintenance.
---

# SDK Behavior Specification

## Overview

Supabase SDK specs are stack-agnostic behavior contracts consumed by two audiences simultaneously: SDK authors implementing behavior in a new language, and QA teams writing conformance tests. Every spec must serve both without ambiguity.

The reference spec repository is `supabase/sdk`, under the `specs/` folder. Specs authored in other repos (e.g. alongside a reference implementation) carry a note indicating their destination.

---

## File Naming

```
NNNN-<topic>.md
```

- `NNNN` — zero-padded 4-digit integer, incremented from the highest existing spec number
- `<topic>` — lowercase, hyphenated, describes the behavior (not the library): `postgrest-retry`, `auth-token-refresh`, `realtime-reconnect`
- No date prefix, no `-spec` suffix

**Examples**: `0001-postgrest-retry.md`, `0002-postgrest-timeout.md`, `0015-auth-token-refresh.md`

To find the next number: `ls specs/ | sort | tail -1`. If the directory is empty, start at `0001`.

---

## Document Structure

Every spec has exactly these sections in this order:

```
1. Header table
2. Abstract
3. Definitions
4. Requirements
5. Scenarios
6. Rationale
7. Changelog
```

Never add, remove, or reorder sections. Never merge sections.

---

## 1. Header Table

```markdown
# <Library> — <Behavior Description>

| Field      | Value                                               |
| ---------- | --------------------------------------------------- |
| Version    | 0.1.0                                               |
| Status     | Draft                                               |
| Date       | YYYY-MM-DD                                          |
| Authors    | Supabase SDK Team                                   |
| References | [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) |
```

**Status lifecycle** — move forward only, never backward:

| Status     | Meaning                                                        |
| ---------- | -------------------------------------------------------------- |
| `Draft`    | Being written; not ready for implementation                    |
| `Review`   | Complete; open for team feedback                               |
| `Stable`   | At least one SDK ships conformant; safe to implement against   |
| `Deprecated` | Superseded by a newer spec; link to replacement             |

**Version** follows semver:
- Patch (`0.1.0 → 0.1.1`): Clarifications, scenario additions, rationale updates — no behavioral change
- Minor (`0.1.0 → 0.2.0`): New requirements or scenarios that extend behavior
- Major (`0.1.0 → 1.0.0`): Breaking changes to existing requirements

---

## 2. Abstract

Two to three sentences. What behavior does this spec define, what does it cover, and what does conformance guarantee. No implementation details.

```markdown
## Abstract

This specification defines the automatic retry behavior for PostgREST client libraries.
It covers which requests are eligible for retry, which conditions trigger a retry, how
delays are computed, and how the behavior is configured. Implementations that conform
to this specification will produce consistent, predictable behavior across all Supabase
SDK languages.
```

---

## 3. Definitions

RFC 2119 boilerplate first (always, verbatim):

```markdown
## Definitions

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document
are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).
```

Then a table of domain terms used normatively in the Requirements section. Include every term that could be ambiguous across languages/platforms.

```markdown
| Term            | Meaning                                                             |
| --------------- | ------------------------------------------------------------------- |
| **attempt**     | A single execution of the HTTP request.                             |
| **retry**       | A subsequent attempt after a previous attempt failed with a retryable condition. |
| **network error** | A failure that prevents an HTTP response from being received at all. |
```

---

## 4. Requirements

The normative core. Defines **what** must be true — not how to implement it.

### Numbering scheme

```
R{section} — Section Name
  R{section}.{item}  Individual requirement
```

Example: `R1` is the first group. `R1.1`, `R1.2` are its requirements. Start a new group when requirements belong to a distinct concern.

```markdown
### R1 — Eligibility

**R1.1** A request MUST only be retried if its HTTP method is `GET`, `HEAD`, or `OPTIONS`.

**R1.2** A request MUST only be retried if retry behavior is enabled for that request.
Retry behavior is enabled by default.
```

### RFC 2119 word usage

| Word | Use for |
| ---- | ------- |
| `MUST` / `MUST NOT` | Absolute requirement — conformance depends on it |
| `SHOULD` / `SHOULD NOT` | Strong recommendation — deviation requires justification |
| `MAY` | Optional behavior |

### What belongs in Requirements

- Observable behavior (inputs → outputs, conditions → outcomes)
- Defaults
- Configuration contracts
- Error/response shapes
- Header names and values

### What does NOT belong in Requirements

- Implementation details (internal timers, loop structures, data structures)
- Code examples
- Rationale — that goes in the Rationale section

---

## 5. Scenarios

Named, machine-readable test cases. QA teams translate these directly into conformance tests.

### Notation

```
→   separates steps in a sequence
[delay]   indicates a pause between attempts (duration unspecified)
```

### Scenario format

```markdown
#### `scenario-slug`
One sentence describing the situation.

**Stimulus**: `METHOD → response-sequence`
**Expected**: What the caller observes. Quantify where possible.
```

### Naming conventions for slugs

- `retry-{method}-{status}` for retry eligibility: `retry-get-520`, `no-retry-post-520`
- `no-retry-{reason}` for non-retry cases: `no-retry-abort`, `no-retry-get-404`
- Descriptive for everything else: `delay-increases`, `retry-exhaustion`, `x-retry-count-header`
- Use hyphens only, lowercase

### Group scenarios under headings

Group by concern, not by audience. Typical groups: Eligibility, Limits, Delay, Observability, Configuration.

### Exact vs. approximate values in Expected

- Use **exact values** when the spec mandates them: `status: 0`, `X-Retry-Count: 2`, `error.code: ""`
- Use **quoted patterns** when the exact string is not contractually fixed: `error.hint` contains `"aborted"` rather than specifying the full message
- Never leave an outcome quantitatively vague: "after approximately 1 second" is acceptable; "after a short delay" is not

### Red flags in scenarios

- `TC-01`, `TC-02` numbering — **wrong**. Use named slugs.
- Given/When/Then — **wrong**. Use Stimulus/Expected.
- Vague expected outcomes ("succeeds", "fails") — **wrong**. State what the caller receives.
- Implementation assertions ("timer fires", "counter increments") — **wrong**. Only observable behavior.

### Cross-spec overlap

When behavior in this spec depends on behavior defined in another spec (e.g. timeout interacts with retry), write a self-contained requirement here rather than deferring to the other spec. Two specs that overlap on behavior are each complete on their own; they are not required to be consistent with each other, and the more specific spec wins at implementation time. Avoid cross-spec references in normative text (`see the retry spec for R3.x` is not acceptable).

---

## 6. Rationale

Non-normative. Explains decisions that would not be obvious to a reader. One paragraph per decision.

Format: bold question → answer paragraph.

```markdown
## Rationale

**Why only GET, HEAD, OPTIONS?** These HTTP methods are defined as safe and idempotent.
Retrying a `POST` or `DELETE` risks duplicate side effects (e.g. double-inserting a row)...

**Why SHOULD for jitter rather than MUST?** Jitter is most valuable when many clients
retry simultaneously...
```

Write a rationale entry for every `SHOULD`, every non-obvious limit, and every place where the spec explicitly excludes something.

---

## 7. Changelog

Track every version that changed observable behavior.

```markdown
## Changelog

| Version | Date       | Description                             |
| ------- | ---------- | --------------------------------------- |
| 0.1.0   | YYYY-MM-DD | Initial draft                           |
| 0.1.1   | YYYY-MM-DD | Clarified R2.2 — any 503 triggers retry |
| 0.2.0   | YYYY-MM-DD | Added R4.5 jitter recommendation        |
```

---

## Creating a New Spec

1. Find the next number: `ls specs/ | sort | tail -1`. Start at `0001` if the directory is empty.
2. Create `NNNN-<topic>.md` with all seven sections
3. Set Status to `Draft`
4. Set Version to `0.1.0`
5. Write Requirements in RFC 2119 language — observable behavior only
6. Add one scenario per distinct behavioral claim in Requirements
7. Write a Rationale entry for every `SHOULD`, non-obvious limit, or explicit exclusion
8. Add the initial changelog entry

---

## Updating an Existing Spec

1. Determine the change type (patch / minor / major — see Version in §1)
2. Edit the relevant section(s)
3. Bump the version in the header table
4. Update the Status if appropriate (e.g. `Draft → Review`)
5. Add a changelog entry with the new version, today's date, and a one-line description
6. If removing or changing a requirement, add a Rationale entry explaining why

**Never remove a changelog entry.** History is permanent.

---

## Common Mistakes

| Mistake | Fix |
| ------- | --- |
| Writing implementation details in Requirements | Move to Rationale or delete — Requirements describe behavior, not mechanics |
| Using TC-01 / TC-02 numbering for scenarios | Use named slugs: `retry-get-520` |
| Using Given/When/Then instead of Stimulus/Expected | Use the spec's Stimulus/Expected format |
| Vague scenario outcomes ("request succeeds") | Be specific: "caller receives the 200 response; one retry was performed" |
| Forgetting RFC 2119 boilerplate in Definitions | Always include it, verbatim, before the term table |
| Writing `MUST` for a SHOULD-level recommendation | `MUST` = conformance breaks without it; `SHOULD` = strong but deviation is justified |
| Skipping Rationale for a `SHOULD` requirement | Every `SHOULD` needs a rationale entry explaining when deviation is acceptable |
| Bumping version without updating Changelog | Always add a changelog entry when the version changes |
