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

### Key Source Files

- `normalize-typedoc-cli.ts` — merge form: `--out <out.json> <in.json>…` concatenates several TypeDoc JSONs (for monorepos)
- `swift-parser.ts` — line-by-line scanner (not AST); extracts `public`/`open` symbols from classes, structs, actors, enums, extensions
- `scripts/dart_symbol_extractor/` — sibling Dart package; `dart run bin/extract.dart <sdk-root>`; parses without `pub get`
- `parse-ignore.ts` — `.sdk-parse-ignore` (gitignore syntax) excludes paths from Swift parsing; TypeScript uses TypeDoc entrypoints instead
- `api-check.ts` / `check-api-symbols.ts` — diff logic + CLI for blocking PRs that add unregistered public symbols

### CI Workflows

- `validate-capabilities.yml` — Runs on push to main, PRs, and nightly; Tier 1: schema/tests/typecheck/structural; Tier 2 (PRs + nightly): reference checks against GitHub
- `validate-sdk-compliance-<language>.yml` — One **reusable workflow** per language (`swift`, `javascript`, `python`, `dart`), called by SDK repos; validates `sdk-compliance.yaml` and blocks PRs that add public symbols not registered in the compliance file. Splitting per language avoids gating every step on a `language` input. For `javascript` (the supabase-js pnpm monorepo) pass `typedoc-packages` — comma-separated package dirs, each with a `docs:json` script that owns its TypeDoc entrypoints; the JS path installs with pnpm and merges all packages. Shared steps live in composite actions under `.github/actions/sdk-compliance-*` (`-validate`, `-check-setup`, `-check-symbols`), referenced as `supabase/sdk/.github/actions/...@main` (the full path is required because a `./` path in a reusable workflow resolves against the caller's checkout, not this repo)
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
  auth.mfa.enroll:
    status: partially_implemented
    note: "TOTP only"
    symbols:
      - GoTrueClient.mfaEnroll   # optional: public symbol names implementing this feature
  storage.objects.upload: not_implemented
```

Valid status values: `implemented`, `partially_implemented`, `not_implemented`, `not_applicable`.

The `symbols` field is optional but enables the public API check in CI: when a PR adds a new public symbol not listed under any `symbols` entry, the check fails and prompts the author to register it.

## Adding a Feature

1. Pick or create a YAML file in `capabilities/` for the relevant area.
2. Add the feature entry; ID must be `{area}.{group}.{method}` and globally unique.
3. Run `npm run validate` — catches schema errors and duplicate IDs.
4. Optionally add a spec at `specs/{area}.{group_namespace}/{method}.md`.

## Commit Style

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`. Use `feat!:` for breaking changes to feature IDs (which affect all SDK compliance files referencing those IDs).
