# SDK Compliance Per-Repo Design

**Date:** 2026-06-10
**Status:** Draft — pending team review

## Problem

SDK compliance data (which features each SDK has implemented) currently lives in this repo's
`capabilities/*.yaml` files inside each feature's `sdks:` block. This creates friction: when an SDK
developer implements a feature, they must open a second PR in this repo to mark it implemented. The
two changes are not atomic, and the compliance data drifts over time.

## Goal

SDK compliance is declared in each SDK's own repository and can be updated in the same PR that
implements the feature. This repo becomes a pure feature registry. A scheduled workflow aggregates
compliance from all SDK repos and rebuilds the matrix.

## Compliance File Format

Each SDK repo places a `supabase-capabilities.yaml` at its root:

```yaml
# supabase-capabilities.yaml
# Canonical spec: https://github.com/supabase/sdk
sdk: javascript

features:
  # Simple scalar for most statuses
  auth.sign_up:                    implemented
  auth.sign_in_with_password:      implemented

  # Map form when a note is needed (required for partially_implemented)
  auth.mfa_enroll:
    status: partially_implemented
    note: "TOTP only — phone factor not yet supported"

  # note is also allowed on other statuses
  auth.sign_in_with_passkey:
    status: not_implemented
    note: "Blocked on platform WebAuthn support"

  # Unlisted features default to not_implemented
```

### Valid statuses

| Status | Note required |
|---|---|
| `implemented` | no (optional) |
| `not_implemented` | no (optional) |
| `not_applicable` | no (optional) |
| `partially_implemented` | **yes** |

### Rules

- Unlisted features default to `not_implemented` — the file can start sparse and grow incrementally
- `note` is allowed on any status; required only on `partially_implemented`
- Feature IDs must match exactly the canonical IDs defined in `capabilities/*.yaml`

## Reusable Validation Workflow

This repo publishes a reusable GitHub Actions workflow. SDK repos call it with one line:

```yaml
# .github/workflows/validate-capabilities.yml (in each SDK repo)
on: [pull_request]
jobs:
  validate:
    uses: supabase/sdk/.github/workflows/validate-capabilities.yml@main
    with:
      file: supabase-capabilities.yaml   # default, optional
```

### What it validates

1. All declared feature IDs exist in the canonical spec → fail if unknown
2. All status values are valid → fail if unrecognised value
3. `partially_implemented` without `note` → fail
4. YAML is well-formed → fail if parse error

The workflow fetches `capabilities/*.yaml` from this repo at `main` on every run — always validates
against the current spec, no version pinning.

## Aggregation Workflow

A scheduled workflow in this repo (`aggregate-capabilities.yml`) runs hourly and on
`workflow_dispatch`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:
```

### Steps

1. Fetch `supabase-capabilities.yaml` from each SDK repo via the GitHub API
2. Load canonical feature list from `capabilities/*.yaml`
3. For each feature, merge compliance entries — unlisted = `not_implemented`
4. Pass merged data to the existing site generator to rebuild the matrix
5. Deploy to GitHub Pages

### SDK repo registry

Hardcoded in the workflow — a small list that rarely changes:

```
supabase/supabase-js       → javascript
supabase/supabase-flutter  → flutter
supabase/supabase-py       → python
supabase/supabase-swift    → swift
supabase/postgrest-csharp  → csharp
supabase/postgrest-go      → go
supabase/supabase-kt       → kotlin
```

If a repo has no compliance file, all its features are treated as `not_implemented` — the workflow
does not fail.

The aggregation workflow uses the default `GITHUB_TOKEN`. All SDK repos are public so no additional
permissions are needed. Exact repo slugs should be verified against actual GitHub org names before
implementation.

## Central YAML Changes

The `sdks:` block is removed from every feature in `capabilities/*.yaml`. Features become:

```yaml
# before
- id: auth.sign_up
  name: Sign Up
  description: Register a new user with email or phone and password.
  group: sign-in
  sdks:
    javascript: { status: implemented, references: [...] }
    flutter: { status: not_implemented }
    ...

# after
- id: auth.sign_up
  name: Sign Up
  description: Register a new user with email or phone and password.
  group: sign-in
```

The JSON schema (`schema/capability-matrix.schema.json`) and TypeScript types
(`scripts/capability-matrix/src/types.ts`) are updated accordingly. The site generator is updated
to consume aggregated compliance data at build time rather than reading it from the YAML.

## Implementation Order

1. Strip `sdks:` from capability YAMLs, update schema and TypeScript types, update site generator
   to accept externally-supplied compliance data
2. Add the reusable validation workflow (`.github/workflows/validate-capabilities.yml`)
3. Add the aggregation workflow (`.github/workflows/aggregate-capabilities.yml`)
4. SDK repos add their `supabase-capabilities.yaml` independently when ready

No SDK repo is touched as part of this implementation. The matrix will show all SDKs as
`not_implemented` until each SDK team adds their compliance file.

## Out of Scope

- Bootstrapping `supabase-capabilities.yaml` in any SDK repo
- Version pinning between the spec and compliance files
- Source code references (file paths, symbol names) in compliance files — status only for now
