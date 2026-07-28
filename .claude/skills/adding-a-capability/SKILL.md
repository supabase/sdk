---
name: adding-a-capability
description: Use when asked to add, register, or define a new SDK capability/feature in this repo — e.g. "add a capability for X", "this should be a new realtime/auth/storage feature", or when a client SDK PR (supabase-js, supabase-flutter, supabase-py, etc.) implements behavior not yet in capabilities/*.yaml
---

# Adding a Capability

## Overview

This repo is the canonical feature registry for Supabase client SDKs (see root `CLAUDE.md`). A "capability" is one row: an `{area}.{group}.{method}` ID plus name/description in `capabilities/{area}.yaml`, optionally backed by a prose spec under `specs/`. Getting the ID, group, and description right — grounded in what the reference SDK actually does, not just what a PR title claims — is the whole job.

## When to Use

- User points at an SDK PR/commit and says "this should be a capability"
- A feature exists in one SDK's public API but has no matching ID in `capabilities/`
- User asks to add a spec for an existing capability

Not for: editing SDK compliance files (those live in each SDK's own repo), or renaming/removing existing IDs (breaking change — needs `feat!:` and cross-repo coordination, out of scope for this skill).

## Steps

1. **Verify the mechanism against a reference implementation before writing anything.** A PR description or issue title often describes user-facing behavior, not the actual wire/API mechanism. Check supabase-js (or the SDK's own repo) source — a client library, a server component (e.g. `supabase/realtime`), or docs at supabase.com/docs — to confirm what actually changes: new field, new combination semantics, new endpoint. Use an explorer/general-purpose agent for this if it requires cloning or grepping an external repo.
2. **Pick the area file**: `capabilities/{area}.yaml` (auth, database, storage, realtime, functions, client). Read its `groups:` list — the feature's `group` must be one of the existing group IDs, or you need to add a new group entry first.
3. **Mint the feature ID**: `{area}.{group}.{method}`, three segments, globally unique across all capability files (grep other yaml files for collisions). `method` is a short snake_case verb/noun for the specific capability, not a restatement of the group. If the new capability is a variant of an existing one (e.g. an alternate mode of an existing operation), reuse that operation's group rather than minting a new one — only add a new group when the capability doesn't belong under any existing one.
4. **Add the entry** in the `features:` list (alphabetical-ish placement near related entries is fine, exact order doesn't matter — schema doesn't enforce it):
   ```yaml
   - id: realtime.subscriptions.postgres_changes_multiple_filters
     name: Multiple Postgres Changes Row Filters
     description: Apply more than one PostgREST-style filter expression to a single Postgres changes subscription, combined with AND, to receive events only for rows matching all of them.
     group: subscriptions
   ```
   `description` should state observable behavior in one sentence, not implementation detail.
5. **Validate**: `cd scripts/capability-matrix && npm run validate` — catches schema errors and duplicate IDs. Fix before continuing.
6. **Optional spec file** for non-trivial behavior (branching logic, constraints, edge cases worth spelling out for implementers): `specs/{area}/{group}/{method}.md`, following `specs/TEMPLATE.md`. This is nested-directory (`area/group/method.md`), matching the actual layout of existing specs (e.g. `specs/auth/sign_in/sign_up.md`) — ignore the dotted `area.group/` example in the template comment and in root `CLAUDE.md`, they're stale relative to what's actually on disk. Keep it prose: behavior, constraints, errors — no SDK-specific function signatures. For the `Related` section, link with the bare feature ID as the href (matching real specs like `specs/realtime/subscriptions/postgres_changes_multiple_filters.md`), not the `../<area>/<feature_id>.md` path the template comment suggests — that form isn't what's actually used on disk.
7. **Re-run `npm run validate`** if you added a spec (structural checks cover spec/ID linkage too).
8. **Commit** with `feat({area}): ...` (conventional commit, per root `CLAUDE.md`).

## Common Mistakes

- Trusting the PR title's framing instead of checking the actual mechanism (e.g. "multiple filters" sounding like multiple bindings when it's really one comma-joined filter string ANDed server-side) — leads to a wrong or misleading spec.
- Using a `group` that isn't in the area file's `groups:` list — validate will catch it, but check first to skip the round-trip.
- Writing the spec at `specs/{area}.{group}/{method}.md` (dotted, single-level) — that's what the template/CLAUDE.md say but not what's actually on disk; use nested `specs/{area}/{group}/{method}.md`.
- Forgetting `npm run validate` before committing — duplicate IDs and schema violations only surface there, not in a visual diff review.

## Related

- Root `CLAUDE.md` — full repo architecture, commands, commit style
- `schema/capability-matrix.schema.json` — the actual schema `npm run validate` checks against
