# Supabase SDK Capability Matrix

The canonical, machine-readable record of which features each official Supabase client SDK implements. One YAML file per product area, validated in CI against a JSON Schema, with every claim of "implemented" backed by a verifiable reference to source code in the SDK's repository.

A static site rendered from these files is published at **https://shiny-adventure-ww2255r.pages.github.io/** (see `.github/workflows/deploy-pages.yml`).

## Repository layout

```
capabilities/   # One YAML file per product area (auth, database, storage, realtime, functions)
schema/         # JSON Schema for area files
scripts/        # TypeScript validator + site generator (scripts/capability-matrix)
.github/        # CI: structural validation, nightly reference drift, Pages deploy
```

## SDKs tracked

Every feature must declare a status for all seven official SDKs:

`javascript` · `flutter` · `python` · `swift` · `csharp` · `go` · `kotlin`

## Status values

| Status | Meaning |
|---|---|
| `implemented` | Feature ships in the SDK. Requires at least one `references` entry pointing to the implementation. |
| `not_implemented` | Feature is in scope but not yet shipped. Must not include references. |
| `not_applicable` | Feature does not apply to this SDK (e.g. browser-only APIs in server SDKs). Must not include references. |

## Adding or updating a capability

1. Open the YAML for the relevant area under `capabilities/` (or create a new file matching the schema).
2. Add or edit a feature entry. Each feature needs `id` (`<area>.<snake_case>`), `name`, `description`, optional `group`, and an `sdks` block covering all seven languages.
3. For any SDK marked `implemented`, add `references` pointing to the source:

   ```yaml
   references:
     - repo: supabase/postgrest-js
       path: src/PostgrestQueryBuilder.ts
       symbols: [select]
       ref: v1.2.3   # optional pin to a tag, branch, or commit
   ```

4. Validate locally (see below).
5. Open a PR. CI runs structural checks on every PR and reference checks on changed files. A nightly job re-runs reference checks across the whole matrix to catch upstream renames.

The full schema lives in `schema/capability-matrix.schema.json` — the validator and editors that understand JSON Schema (via the `yaml-language-server` header at the top of each area file) will autocomplete and error-check as you type.

## Local development

```bash
cd scripts/capability-matrix
npm ci

npm test               # vitest suite for the validator
npm run typecheck      # tsc --noEmit
npm run validate       # tier 1: schema + structural checks (no network)
npm run validate:online # tier 2: also fetch each reference and verify the file/symbol exists
npm run report         # parity report as JSON (overall, per-area, per-language)
npm run build-site     # render the static site to scripts/capability-matrix/site/
```

`validate:online` and the nightly CI job hit the GitHub REST API; set `GITHUB_TOKEN` in the environment to avoid rate limits.

## CI

| Workflow | Trigger | What it does |
|---|---|---|
| `validate-capabilities.yml` | push to `main`, PRs touching matrix files, nightly cron | Tier 1 structural on every run; tier 2 references on PRs (changed files) and nightly (all files). |
| `deploy-pages.yml` | push to `main` touching matrix files, manual dispatch | Builds the site and deploys to GitHub Pages. |
