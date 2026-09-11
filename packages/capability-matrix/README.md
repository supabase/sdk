# Supabase SDK Capability Matrix

The canonical, machine-readable record of which features exist across Supabase client SDKs. This package is a **pure feature registry** — it defines what features exist and what they mean. Each SDK repo is responsible for declaring which features it implements.

A static site rendered from this data is published at [https://supabase.github.io/sdk/](https://supabase.github.io/sdk/).

## Package layout

```
capabilities/   # One YAML file per product area (auth, database, storage, realtime, functions)
specs/          # Optional human-readable spec per feature: specs/{area}/{group}/{feature}.md
schema/         # JSON Schema for area files
docs/           # Longer-form documentation (capability-matrix.md)
src/            # TypeScript validator + site generator
test/           # Vitest suite
```

CI workflows live at the repository root under `.github/` (see [CI](#ci)).

## SDKs tracked

`javascript` · `flutter` · `python` · `swift` · `csharp` · `go` · `kotlin`

## Status values

| Status                  | Meaning                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `implemented`           | Feature is fully implemented in the SDK.                                           |
| `partially_implemented` | Feature is partially implemented. A `note` explaining what is missing is required. |
| `not_implemented`       | Feature is in scope but not yet shipped (default for unlisted features).           |
| `not_applicable`        | Feature does not apply to this SDK (e.g. browser-only APIs in a server SDK).       |

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
api_coverage: additions # optional: additions (default) or full

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

### API coverage modes

`api_coverage` controls how the blocking public API check interprets the
extracted SDK surface:

- `additions` is the backward-compatible default. On pull requests, CI compares
  the current API with the target branch and requires only newly added symbols
  to be registered. Existing unregistered symbols remain grandfathered.
- `full` audits the current checkout by itself. Every extracted public symbol
  must be registered under `symbols` or `supporting_symbols`, and every
  registered symbol must still exist. It does not need a target-branch checkout,
  so the same check works on pull requests, pushes, and manual runs.

New SDKs should prefer `full`. Existing SDKs can remain on `additions` until
their current public surface has been catalogued, then switch modes in the same
change that completes that catalogue.

### Opt-in to validation

Add `.github/workflows/validate-capabilities.yml` to your SDK repo:

```yaml
on: [pull_request]
jobs:
  validate:
    uses: supabase/sdk/.github/workflows/validate-sdk-compliance-swift.yml@main
```

JavaScript / TypeScript SDKs use the `validate-sdk-compliance-javascript.yml` workflow, which requires a `typedoc-packages` input:

```yaml
on: [pull_request]
jobs:
  validate:
    uses: supabase/sdk/.github/workflows/validate-sdk-compliance-javascript.yml@main
    with:
      typedoc-packages: packages/core/auth-js,packages/core/storage-js
```

There is one reusable workflow per language — pick the one matching your SDK:

| Language                | Workflow                                 |
| ----------------------- | ---------------------------------------- |
| Swift                   | `validate-sdk-compliance-swift.yml`      |
| JavaScript / TypeScript | `validate-sdk-compliance-javascript.yml` |
| Python                  | `validate-sdk-compliance-python.yml`     |
| Dart                    | `validate-sdk-compliance-dart.yml`       |

The JavaScript workflow requires a `typedoc-packages` input — comma-separated package dirs (relative to the SDK root), each defining a `docs:json` script that owns its TypeDoc entrypoints; the JS path installs with pnpm and merges all packages. The Python workflow requires a `griffe-packages` input and accepts an optional `griffe-search-paths` input.

This checks out the canonical feature list from this repo and runs two checks on every PR:

1. **Compliance validation** — verifies your `sdk-compliance.yaml` against the canonical feature list.
2. **Public API check** — parses the SDK's public symbols and applies the
   `api_coverage` mode declared in `sdk-compliance.yaml`.

For a repository using `api_coverage: full`, invoke the reusable workflow from
every event that should enforce complete coverage:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

An `additions`-mode API check is skipped outside pull requests because it needs
a target branch for comparison. Compliance-file validation still runs.

### Pinning

This repo is tagged (`v1`, `v1.2.3`, ...) via [release-please](../../.github/workflows/release.yml). Pin `uses:` references to a release tag's commit SHA, with the tag as a comment, the same way this repo pins its own third-party actions:

```yaml
uses: supabase/sdk/.github/workflows/validate-sdk-compliance-swift.yml@<sha> # v1.2.3
```

Dependabot picks up new tags automatically and opens a PR to bump the pin — see each SDK repo's `dependabot.yml` (`package-ecosystem: github-actions`). Avoid pinning to `@main`: it floats, so every consumer would pick up a change the moment it lands on this repo, without going through that consumer's own review.

## Local development

```bash
cd packages/capability-matrix
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

`npm run aggregate` uses `GITHUB_TOKEN` when it is set. Without one it falls back to anonymous requests, which GitHub limits to 60 per hour per IP address.

## CI

| Workflow                                 | Trigger                                            | What it does                                                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `capability-matrix-validate.yml`         | push to `main`, PRs touching matrix files, nightly | Tier 1: schema, tests, typecheck, structural checks. Tier 2 (PRs + nightly): reference checks against GitHub.                                                                                                                        |
| `validate-sdk-compliance-<language>.yml` | `workflow_call` from SDK repos                     | One reusable workflow per language (`swift`, `javascript`, `python`, `dart`). Validates an SDK's `sdk-compliance.yaml`; checks either newly added symbols or the complete public API according to `api_coverage`. |
| `capability-matrix-deploy-pages.yml`     | push to `main`, daily cron, `workflow_dispatch`    | Fetches all SDK compliance files, builds the site, deploys to GitHub Pages.                                                                                                                                                          |
