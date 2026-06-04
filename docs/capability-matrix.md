# SDK Capability Matrix

The capability matrix is the canonical record of what every official Supabase SDK
can do. It is the data source for **KPI 5 — Cross-SDK Feature Parity Rate**.

## Layout

- `capabilities/<area>.yaml` — one file per product area (auth, database, storage,
  realtime, functions, ...). Each file declares the features in that area.
- `schema/capability-matrix.schema.json` — the JSON Schema every area file must
  satisfy. It encodes the canonical SDK list and status vocabulary.
- `scripts/capability-matrix/` — the validator (`npm run validate` /
  `validate:online` / `report`).

## Tracked SDKs

Seven languages, identified by language only (not by sub-package):

`javascript`, `flutter`, `python`, `swift`, `csharp`, `go`, `kotlin`.

Every feature MUST report a status for all seven.

## Area file shape

```yaml
area: auth                  # lowercase slug; MUST match the filename
title: Authentication       # human Title Case
description: ...             # 1–2 sentence summary of the area
features:
  - id: auth.sign_in_with_otp   # <area>.<snake_case>; globally unique; never renamed
    name: Sign in with OTP      # human Title Case
    description: ...            # 1–2 sentence human-facing summary
    group: passwordless        # optional, display/filter label only
    sdks:                      # MUST contain all 7 language keys
      javascript:
        status: implemented    # implemented | not_implemented | not_applicable
        since: "2.0.0"        # optional semver
        references:           # required iff status == implemented; forbidden otherwise
          - repo: supabase/auth-js   # owner/name
            path: src/GoTrueClient.ts # repo-relative; NO line numbers
            symbols: [signInWithOtp]  # optional; method/property names
            ref: main                 # optional; commit/tag/branch to pin checks
      go:
        status: not_applicable
        notes: Out of scope for gotrue-go.   # SHOULD justify not_applicable
```

## Status values

| Value             | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `implemented`     | Available in the released SDK. MUST carry `references`.              |
| `not_implemented` | Absent — covers unstarted, in-progress, and planned alike.          |
| `not_applicable`  | Does not apply to this language/platform. Excluded from parity. SHOULD carry `notes`. |

## Conventions

- **`id` is the contract.** CI guards, parity scores, and code references key off
  it. Once published, never rename an `id` — remove the entry to retire a feature,
  or add a new `id` to rename.
- **No line numbers in paths.** They drift; use `symbols` for intra-file precision.
- **Pin `ref`** only when default-branch validation against an upstream repo is noisy.

## Parity score (KPI 5)

- A feature's **applicable SDKs** = languages whose status is not `not_applicable`.
- **Feature parity** = `implemented / applicable` for that feature.
- **Cross-SDK Feature Parity Rate** = mean of feature parity across all features.
  Also reported per area and per language.

Regenerate the numbers mechanically:

```bash
cd scripts/capability-matrix && npm run report
```

## Validation

- **Tier 1 (offline, every PR):** schema conformance, `area`==filename, `id`
  prefix + global uniqueness, all 7 languages present, `implemented`⇔`references`,
  no line numbers, valid semver `since`. `not_applicable` without `notes` is a warning.
- **Tier 2 (online):** each reference's `path` exists in its `repo`, and every
  listed `symbol` appears in that file. Missing path or symbol is an error. Runs on
  changed files in PRs and across all files nightly to catch upstream drift.

```bash
cd scripts/capability-matrix
npm install
npm run validate                                   # Tier 1
GITHUB_TOKEN=$(gh auth token) npm run validate:online   # Tier 1 + Tier 2
```
