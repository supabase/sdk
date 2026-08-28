# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a lightweight monorepo of shared tooling for the Supabase client SDKs. Projects live as flat siblings under `packages/`, each with a single toolchain and no monorepo build tooling on top:

- `packages/capability-matrix/` — the **canonical feature registry** for all Supabase client SDKs — not the SDKs themselves. It defines what features exist (name, description, grouping) across 7 client SDKs (JavaScript, Flutter, Python, Swift, C#, Go, Kotlin). SDKs declare compliance separately in their own repos via `sdk-compliance.yaml` files. The output is a static capability matrix website at https://supabase.github.io/sdk/ showing which features each SDK implements.
- `packages/dart-symbol-extractor/` — Dart public API symbol extractor used by the Dart compliance workflow.
- `packages/go-symbol-extractor/` — Go public API symbol extractor used by the Go compliance workflow.
- `packages/postgrest-typegen/` — introspects a PostgreSQL schema into the `GeneratorMetadata` contract and generates PostgREST types for TypeScript, Go, Python, and Swift. See its own `CLAUDE.md` for architecture and the byte-parity constraint with postgres-meta.

## Commands

The capability-matrix scripts live under `packages/capability-matrix/`. Run them from that directory:

```bash
cd packages/capability-matrix
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

### Key Directories (under `packages/capability-matrix/`)

- `capabilities/` — YAML files, one per product area (auth, database, storage, realtime, functions, client). These are the source of truth for feature IDs and definitions.
- `schema/capability-matrix.schema.json` — JSON Schema that validates capability YAML files. Feature IDs must follow three-segment format: `area.group_namespace.feature`.
- `specs/` — Optional Markdown specs for individual features. Referenced by feature ID stem.
- `src/` — TypeScript source for validation, aggregation, and site generation.
- `test/` — Vitest test suite with fixtures in `test/fixtures/`.

### Key Source Files

- `normalize-typedoc-cli.ts` — merge form: `--out <out.json> <in.json>…` concatenates several TypeDoc JSONs (for monorepos)
- `swift-parser.ts` — line-by-line scanner (not AST); extracts `public`/`open` symbols from classes, structs, actors, enums, extensions
- `packages/dart-symbol-extractor/` — sibling Dart package (Dart package name `dart_symbol_extractor`); `dart run bin/extract.dart <sdk-root>`; parses without `pub get`
- `parse-ignore.ts` — `.sdk-parse-ignore` (gitignore syntax) excludes paths from Swift parsing; TypeScript uses TypeDoc entrypoints instead
- `api-check.ts` / `check-api-symbols.ts` — diff logic + CLI for blocking PRs that add unregistered public symbols

### CI Workflows

- `capability-matrix-validate.yml` — Runs on push to main, PRs, and nightly; Tier 1: schema/tests/typecheck/structural; Tier 2 (PRs + nightly): reference checks against GitHub. Its display name (`Validate Capabilities`) is referenced by `release.yml`'s `workflow_run` trigger — keep them in sync
- `validate-sdk-compliance-<language>.yml` — One **reusable workflow** per language (`swift`, `javascript`, `python`, `dart`), called by SDK repos; validates `sdk-compliance.yaml` and blocks PRs that add public symbols not registered in the compliance file. Splitting per language avoids gating every step on a `language` input. For `javascript` (the supabase-js pnpm monorepo) pass `typedoc-packages` — comma-separated package dirs, each with a `docs:json` script that owns its TypeDoc entrypoints; the JS path installs with pnpm and merges all packages. Shared steps live in composite actions under `.github/actions/sdk-compliance-*` (`-validate`, `-check-setup`, `-check-symbols`), referenced as `supabase/sdk/.github/actions/...@main` (the full path is required because a `./` path in a reusable workflow resolves against the caller's checkout, not this repo)
- `capability-matrix-deploy-pages.yml` — Fetches all SDK compliance data, rebuilds the site, and deploys to GitHub Pages (main push, daily cron, manual dispatch)
- `release.yml` — release-please over five components. The repo root (`simple`, tags `vX.Y.Z`) versions the reusable workflows plus the tooling they check out; every path except `packages/postgrest-typegen` stays attributed to it, because SDK repos consume tooling via the root tag SHA, so tooling fixes must keep producing root releases. `packages/capability-matrix`, `packages/dart-symbol-extractor`, and `packages/go-symbol-extractor` are additionally their own components (tags `<component>-vX.Y.Z`, changelog and version bump only, nothing is published). `packages/postgrest-typegen` (`node`, tags `postgrest-typegen-vX.Y.Z`) is fully independent: when its release is created, the `publish-postgrest-typegen` job builds with bun and publishes `@supabase/postgrest-typegen` to npm via OIDC trusted publishing (no npm token; the trusted publisher must be configured on npmjs.com)

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

1. Pick or create a YAML file in `packages/capability-matrix/capabilities/` for the relevant area.
2. Add the feature entry; ID must be `{area}.{group}.{feature}` and globally unique.
3. Run `npm run validate` — catches schema errors and duplicate IDs.
4. Optionally add a spec at `packages/capability-matrix/specs/{area}/{group}/{feature}.md`.

## Commit Style

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`. Use `feat!:` for breaking changes to feature IDs (which affect all SDK compliance files referencing those IDs).
