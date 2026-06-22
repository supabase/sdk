# Supabase SDK Capability Matrix

The canonical, machine-readable record of which features exist across Supabase client SDKs. This repository is a **pure feature registry** — it defines what features exist and what they mean. Each SDK repo is responsible for declaring which features it implements.

A static site rendered from this data is published at [https://supabase.github.io/sdk/](https://supabase.github.io/sdk/).

## Repository layout

```
capabilities/   # One YAML file per product area (auth, database, storage, realtime, functions)
specs/          # Optional human-readable spec per feature: specs/{area}/{feature}.md
schema/         # JSON Schema for area files
scripts/        # TypeScript validator + site generator (scripts/capability-matrix)
.github/        # CI workflows (see below)
```

## SDKs tracked

`javascript` · `flutter` · `python` · `swift` · `csharp` · `go` · `kotlin`

## Status values

| Status | Meaning |
|---|---|
| `implemented` | Feature is fully implemented in the SDK. |
| `partially_implemented` | Feature is partially implemented. A `note` explaining what is missing is required. |
| `not_implemented` | Feature is in scope but not yet shipped (default for unlisted features). |
| `not_applicable` | Feature does not apply to this SDK (e.g. browser-only APIs in a server SDK). |

## Adding or updating a capability

1. Open the YAML for the relevant area under `capabilities/` (or create a new file matching the schema).
2. Add or edit a feature entry. Each feature needs `id` (`<area>.<snake_case>`), `name`, `description`, and an optional `group`.
3. Optionally add a spec file at `specs/<area>/<feature>.md` documenting the expected behavior. The validator enforces that every spec file has a matching feature ID.
4. Validate locally and open a PR. CI runs structural checks (including spec file validation) on every PR.

The full schema lives in `schema/capability-matrix.schema.json`.

## SDK compliance

SDK compliance is **declared in each SDK repo**, not here. To report which features your SDK implements, add a `sdk-compliance.yaml` file to the root of your SDK repo:

```yaml
sdk: javascript   # one of: javascript, flutter, python, swift, csharp, go, kotlin

features:
  auth.sign_up:                implemented
  auth.sign_in_with_password:  implemented

  auth.mfa_enroll:
    status: partially_implemented
    note: "TOTP only — phone factor not yet supported"
    symbols:
      - GoTrueClient.mfaEnroll   # public symbol names that implement this feature

  # Unlisted features default to not_implemented
```

The file is **sparse** — only list features that differ from `not_implemented`. Unknown feature IDs and invalid status values fail CI.

The optional `symbols` field maps a compliance entry to the public API symbols in your SDK. CI uses this to detect when a PR adds a new public symbol that is not yet registered — see [Opt-in to validation](#opt-in-to-validation) below.

### Opt-in to validation

Add `.github/workflows/validate-capabilities.yml` to your SDK repo:

```yaml
on: [pull_request]
jobs:
  validate:
    uses: supabase/sdk/.github/workflows/validate-sdk-compliance.yml@main
    with:
      language: swift   # one of: swift, javascript, dart
```

This checks out the canonical feature list from this repo and runs two checks on every PR:

1. **Compliance validation** — verifies your `sdk-compliance.yaml` against the canonical feature list.
2. **Public API check** — parses the SDK's public symbols, diffs against the base branch, and fails if any new symbol is not registered in `sdk-compliance.yaml`.

## Local development

```bash
cd scripts/capability-matrix
npm ci

npm test                           # vitest suite for the validator
npm run typecheck                  # tsc --noEmit
npm run validate                   # schema + structural checks (no network)
npm run validate:online            # + reference checks against GitHub (needs GITHUB_TOKEN)
npm run report                     # parity report as JSON (overall, per-area, per-language)
npm run validate-compliance <file> # validate a sdk-compliance.yaml against the canonical spec
npm run aggregate                  # fetch all SDK compliance files → site/compliance.json
npm run build-site                 # render the static site to site/index.html
npm run build-site compliance.json # render the site with compliance data
```

## CI

| Workflow | Trigger | What it does |
|---|---|---|
| `validate-capabilities.yml` | push to `main`, PRs touching matrix files, nightly | Tier 1: schema, tests, typecheck, structural checks. Tier 2 (PRs + nightly): reference checks against GitHub. |
| `validate-sdk-compliance.yml` | `workflow_call` from SDK repos | Validates an SDK's `sdk-compliance.yaml` against the canonical feature list; blocks PRs that add public symbols not registered in the compliance file. |
| `aggregate-capabilities.yml` | hourly cron + `workflow_dispatch` | Fetches all SDK compliance files, builds the site, deploys to GitHub Pages. |
