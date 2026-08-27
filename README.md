# Supabase SDK

Shared tooling and specifications for the Supabase client SDKs. This repository is a lightweight monorepo: each project lives as a flat sibling under `packages/`, with a single toolchain per package and no monorepo build tooling on top.

## Packages

| Package                                                              | Toolchain  | What it is                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/capability-matrix`](./packages/capability-matrix)         | TypeScript | The canonical feature registry for all Supabase client SDKs: capability YAML data, per-feature specs, JSON Schema, validator, and site generator. Renders [supabase.github.io/sdk](https://supabase.github.io/sdk/). |
| [`packages/dart-symbol-extractor`](./packages/dart-symbol-extractor) | Dart       | Public API symbol extractor for Dart SDKs, used by the Dart compliance workflow.                                                                                                                                     |
| [`packages/go-symbol-extractor`](./packages/go-symbol-extractor)     | Go         | Public API symbol extractor for Go SDKs, used by the Go compliance workflow.                                                                                                                                         |
| [`packages/postgrest-typegen`](./packages/postgrest-typegen)         | TypeScript | Type generator for PostgREST schemas. Currently an empty scaffold, implementation to follow.                                                                                                                         |

## Repository layout

```
packages/       # One directory per project (flat siblings, one toolchain each)
.github/        # CI workflows and composite actions, including the reusable
                # SDK compliance workflows consumed by the SDK repos
```

The workflow and action paths under `.github/` are a public interface: SDK repos reference `supabase/sdk/.github/workflows/validate-sdk-compliance-<language>.yml`, `sync-sdk-compliance.yml`, and the `sdk-compliance-*` composite actions. Those file names and locations are stable.

## SDK compliance

If you are here to opt an SDK into compliance validation, or to update which features your SDK supports, see the [capability-matrix README](./packages/capability-matrix/README.md#sdk-compliance).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Run each package's own toolchain from its directory:

```bash
cd packages/capability-matrix && npm ci && npm test
cd packages/dart-symbol-extractor && dart pub get && dart test
cd packages/go-symbol-extractor && go test ./...
```
