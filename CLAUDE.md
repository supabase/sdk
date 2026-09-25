# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a lightweight monorepo of shared tooling for the Supabase client SDKs. Projects live as flat siblings under `packages/`, each with a single toolchain and no monorepo build tooling on top:

- `packages/capability-matrix/` — the **canonical feature registry** for all Supabase client SDKs — not the SDKs themselves. It defines what features exist (name, description, grouping) across 7 client SDKs (JavaScript, Flutter, Python, Swift, C#, Go, Kotlin). SDKs declare compliance separately in their own repos via `sdk-compliance.yaml` files. The output is a static capability matrix website at https://supabase.github.io/sdk/ showing which features each SDK implements.
- `packages/dart-symbol-extractor/` — Dart public API symbol extractor used by the Dart compliance workflow.
- `packages/go-symbol-extractor/` — Go public API symbol extractor used by the Go compliance workflow.
- `packages/postgrest-typegen/` — introspects a PostgreSQL schema into the `GeneratorMetadata` contract and generates PostgREST types for TypeScript, Go, Python, and Swift. See its own `CLAUDE.md` for architecture and how postgres-meta and the CLI consume it.
- `packages/typegen/`: the language registry for `supabase gen types --lang`. `languages` maps each name to a generator, either in-process (the four bundled in postgrest-typegen) or an external tool run in the user's project (Dart via `dart run supabase_typegen`). The CLI dispatches through it, so adding a language is a pull request here plus a CLI dependency bump. See its own `CLAUDE.md`.

## Commands

The capability-matrix scripts live under `packages/capability-matrix/`. Run them from that directory:

```bash
cd packages/capability-matrix
bun install                     # Install deps (first time / after changes)
bun test                        # Run full test suite
bun run typecheck               # TypeScript check (strict, noEmit)
bun run format-and-lint         # oxfmt --check + oxlint
bun run knip                    # Unused files, exports, and dependencies
bun run validate                # Schema + structural checks (offline)
bun run validate:online         # + reference checks against GitHub (needs GITHUB_TOKEN)
bun run report                  # Generate JSON parity report
bun run validate-compliance <file>  # Validate a single SDK compliance file
bun run aggregate               # Fetch all SDK compliance files via GitHub API
bun run build-site              # Build HTML site (uses cached compliance data)
bun run build-site <compliance.json>  # Build with specific compliance data
```

`bun run aggregate` uses `GITHUB_TOKEN` when it is set. Without one it falls back to anonymous requests, which GitHub limits to 60 per hour per IP address.

To run a single test file:
```bash
bun test test/schema.test.ts
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
- `test/` — `bun:test` suite with fixtures in `test/fixtures/`.

### Key Source Files

- `normalize-typedoc-cli.ts` — merge form: `--out <out.json> <in.json>…` concatenates several TypeDoc JSONs (for monorepos)
- `swift-parser.ts` — line-by-line scanner (not AST); extracts `public`/`open` symbols from classes, structs, actors, enums, extensions
- `packages/dart-symbol-extractor/` — sibling Dart package (Dart package name `dart_symbol_extractor`); `dart run bin/extract.dart <sdk-root>`; parses without `pub get`
- `parse-ignore.ts` — `.sdk-parse-ignore` (gitignore syntax) excludes paths from Swift parsing; TypeScript uses TypeDoc entrypoints instead
- `api-check.ts` / `check-api-symbols.ts` — blocking public API coverage logic + CLI; `additions` mode diffs a PR against its base, while `full` mode statically audits one checkout

### CI Workflows

- `capability-matrix-validate.yml` — Runs on push to main, PRs, and nightly; Tier 1: schema/tests/typecheck/structural; Tier 2 (PRs + nightly): reference checks against GitHub. Its display name (`Validate Capabilities`) is referenced by `release.yml`'s `workflow_run` trigger — keep them in sync
- `validate-sdk-compliance-<language>.yml` — One **reusable workflow** per language (`swift`, `javascript`, `python`, `dart`), called by SDK repos; validates `sdk-compliance.yaml` and applies its `api_coverage` policy. `additions` (the default) checks PR-only API changes against the base branch, while `full` checks the complete current surface on PR, push, or dispatch events without a base checkout. Splitting per language avoids gating every step on a `language` input. For `javascript` (the supabase-js pnpm monorepo) pass `typedoc-packages` — comma-separated package dirs, each with a `docs:json` script that owns its TypeDoc entrypoints; the JS path installs with pnpm and merges all packages. Shared steps live in composite actions under `packages/capability-matrix/actions/sdk-compliance-*` (`-validate`, `-check-setup`, `-check-symbols`, `-check-drift`), referenced through the `_sdk-spec` checkout (`./_sdk-spec/packages/capability-matrix/actions/...`) that the wrappers pin to `job.workflow_sha`, so wrapper and action code always come from the same commit. The wrappers themselves must stay in `.github/workflows/` (a GitHub requirement for `workflow_call`); keep them thin shims, since wrapper-only commits do not bump the capability-matrix component — force a release with a `Release-As: x.y.z` commit footer if one ever needs to ship alone
- `capability-matrix-deploy-pages.yml` — Fetches all SDK compliance data, rebuilds the site, and deploys to GitHub Pages (main push, daily cron, manual dispatch)
- `release.yml` — release-please for capability-matrix; postgrest-typegen and typegen run release-please from their own workflows, so three components are released in total. The repo root is deliberately not versioned anymore (the historical `vX.Y.Z` tags up to 1.5.0 remain for consumers pinned to them). Both configs set `tag-separator: "/"` because dependabot only recognizes `package/vX.Y.Z` tags; releases before the switch used a `-` separator (`capability-matrix-vX.Y.Z`), which release-please still finds since it matches previous releases by component and version, not by separator. `packages/capability-matrix` (`node`, tags `capability-matrix/vX.Y.Z`) gets a changelog and version bump only, nothing is published; its tags are what SDK repos pin the reusable compliance workflows at, since the compliance logic lives in the package. The symbol extractors are not release-managed at all. `packages/postgrest-typegen` (`node`, tags `postgrest-typegen/vX.Y.Z`) additionally publishes: when its release is created, the `publish-postgrest-typegen` job builds with bun and publishes `@supabase/postgrest-typegen` to npm via OIDC trusted publishing (no npm token; the trusted publisher must be configured on npmjs.com). `packages/typegen` (`node`, tags `typegen/vX.Y.Z`, config `release-please-config.typegen.json`, workflow `release-typegen.yml`) follows the same on-demand pattern and publishes `@supabase/typegen`; its manifest starts at `0.0.0` so the first release is `0.1.0`. On-demand means both workflows run release-please only on `workflow_dispatch` or on a push that changes their manifest file, which happens only when a release PR merges; merging ordinary `fix:`/`feat:` commits into the package opens no release PR until someone dispatches the workflow
- bun installs through `oven-sh/setup-bun` (SHA-pinned, `bun-version: latest`), the same convention supabase-js uses. The runtime version deliberately floats; only the action itself is pinned, and dependabot's `github-actions` group keeps that SHA current
- `dependabot.yml` — every JavaScript package commits a `bun.lock`, so a single `bun` entry globs `/packages/*`. Do not move them back to the `npm` ecosystem: it rewrites `package.json` without touching `bun.lock`, which leaves the lockfile stale and fails every `bun install --frozen-lockfile` step. `oxfmt` is ignored there on purpose: postgrest-typegen formats its generated output with it, so a bump changes generated code and must be done manually in all JavaScript packages together

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
3. Run `bun run validate` — catches schema errors and duplicate IDs.
4. Optionally add a spec at `packages/capability-matrix/specs/{area}/{group}/{feature}.md`.

## Commit Style

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`. Use `feat!:` for breaking changes to feature IDs (which affect all SDK compliance files referencing those IDs).
