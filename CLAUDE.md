# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is the **canonical feature registry** for all Supabase client SDKs — not the SDKs themselves. It defines what features exist (name, description, grouping) across 7 client SDKs (JavaScript, Flutter, Python, Swift, C#, Go, Kotlin). SDKs declare compliance separately in their own repos via `sdk-compliance.yaml` files.

The output is a static capability matrix website at https://supabase.github.io/sdk/ showing which features each SDK implements.

## Commands

All scripts live under `scripts/capability-matrix/`. Run them from that directory:

```bash
cd scripts/capability-matrix
npm ci                          # Install deps (first time / after changes)
npm test                        # Run full test suite (Vitest)
npm run typecheck               # TypeScript check (strict, noEmit)
npm run validate                # Schema + structural checks (offline)
npm run validate:online         # + reference checks against GitHub (needs GITHUB_TOKEN)
npm run report                  # Generate JSON parity report
npm run validate-compliance <file>  # Validate a single SDK compliance file
npm run aggregate               # Fetch all SDK compliance files via GitHub API
npm run build-site              # Build HTML site (uses cached compliance data)
npm run build-site <compliance.json>  # Build with specific compliance data
```

To run a single test file:
```bash
npx vitest run test/schema.test.ts
```

## Architecture

### Data Flow

```
capabilities/*.yaml  →  validate (AJV schema)  →  aggregate (GitHub API fetches SDK compliance)
                                                          ↓
                                               generate-site.ts  →  static HTML (GitHub Pages)
```

### Key Directories

- `capabilities/` — YAML files, one per product area (auth, database, storage, realtime, functions, client). These are the source of truth for feature IDs and definitions.
- `schema/capability-matrix.schema.json` — JSON Schema that validates capability YAML files. Feature IDs must follow three-segment format: `area.group_namespace.method`.
- `specs/` — Optional Markdown specs for individual features. Referenced by feature ID stem.
- `scripts/capability-matrix/src/` — TypeScript source for validation, aggregation, and site generation.
- `scripts/capability-matrix/test/` — Vitest test suite with fixtures in `test/fixtures/`.

### Source Files

- `types.ts` — Core types: `Language` (7 SDKs), `Status` (4 values), `Feature`, `AreaFile`, `ComplianceMap`
- `load.ts` — Loads capability YAML files
- `schema.ts` — AJV-based schema validation
- `structural.ts` — Cross-file checks: spec orphan detection, duplicate feature IDs, ID format enforcement
- `compliance.ts` — Parses and validates SDK `sdk-compliance.yaml` files; `buildSymbolIndex` maps registered symbols to feature IDs
- `api-check.ts` — `checkNewSymbols`: diff PR vs base symbols, find uncovered new symbols or removed registered symbols
- `check-api-symbols.ts` — CLI entry point for `npm run check-api-symbols`
- `normalize-dartdoc.ts` — Normalizes `dartdoc_json` 0.5.0 output (`DartdocUnit[]`) to `ParseResult`
- `normalize-dartdoc-cli.ts` — CLI entry point for `npm run normalize-dartdoc`
- `ts-parser.ts` / `parse-ts.ts` — TypeScript/JavaScript public API surface parser
- `swift-parser.ts` / `parse-swift.ts` — Swift public API surface parser
- `aggregate.ts` — Fetches compliance files from all SDK repos via Octokit
- `generate-site.ts` — Builds the static HTML matrix site
- `report.ts` — Calculates parity percentages per feature/area/language

### CI Workflows

- `validate-capabilities.yml` — Runs on push to main and PRs; validates schema, types, tests, structure
- `validate-sdk-compliance.yml` — **Reusable workflow** called by SDK repos to validate their compliance files against this repo's canonical feature list
- `aggregate-capabilities.yml` — Hourly cron that fetches all SDK compliance data and rebuilds the site
- `deploy-pages.yml` — Deploys to GitHub Pages on main push

## Feature IDs

Feature IDs use three segments: `{area}.{group}.{method}` (e.g., `auth.sign_in.email`, `storage.buckets.create`). The area must match the file's `area` field. IDs must be globally unique across all capability files.

## SDK Compliance Format

Each SDK repo hosts a `sdk-compliance.yaml` at a known path. Format:
```yaml
sdk: javascript
features:
  auth.sign_in.email: implemented
  auth.mfa.enroll: partially_implemented
  storage.objects.upload: not_implemented
```

Valid status values: `implemented`, `partially_implemented`, `not_implemented`, `not_applicable`.

## Commit Style

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`. Use `feat!:` for breaking changes to feature IDs (which affect all SDK compliance files referencing those IDs).
