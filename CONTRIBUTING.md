# Contributing to the Supabase SDK Capability Matrix

Thanks for your interest in contributing. This repo is the canonical, machine-readable record of which features exist across Supabase client SDKs. It is a **pure feature registry**: it defines what features exist and what they mean. Per-SDK compliance is declared in each SDK's own repo (see [README](./README.md#sdk-compliance)).

## Ways to contribute

- **Add or update a capability** in `capabilities/<area>.yaml`
- **Document a feature's behavior** by adding a spec file under `specs/<area>/<feature>.md`
- **Improve the validator or site generator** in `scripts/capability-matrix/`
- **Report a bug or request a change** via [GitHub Issues](https://github.com/supabase/sdk/issues)

For security issues, please follow [SECURITY.md](./SECURITY.md) instead of filing a public issue.

## Before you start

- Search existing issues and open PRs to avoid duplicating work.
- For non-trivial changes (new product area, schema change, renaming a feature ID), open an issue first so we can align on scope. Feature ID renames are breaking for any SDK that already references the ID in its `sdk-compliance.yaml`.

## Adding or updating a capability

1. Open the YAML for the relevant area under `capabilities/` (or create a new area file matching `schema/capability-matrix.schema.json`).
2. Add or edit a feature entry. Required fields:
   - `id` — `<area>.<snake_case>` (e.g. `auth.sign_in_with_password`). Must be unique and stable.
   - `name` — human-readable title.
   - `description` — one or two sentences explaining what the feature does.
   - `group` (optional) — the group ID this feature belongs to within the area.
3. Keep features SDK-agnostic. Describe observable behavior, not a specific language's API shape.
4. If you need a new group, add it under `groups:` at the top of the area file.

### Choosing a feature ID

- Lowercase, snake_case, prefixed with the area: `auth.mfa_enroll`, `storage.upload`.
- Prefer the verb-object pattern users will recognize from the docs.
- For admin or scoped variants, namespace explicitly: `auth.admin.delete_user`.
- Once a feature ID ships, treat it as a public contract. Renames require coordinated updates in every SDK's `sdk-compliance.yaml`.

## Adding a spec file

Spec files are optional but encouraged for any feature with non-trivial behavior. They are free-form prose for humans and LLMs.

1. Create `specs/<area>/<feature_id_stem>.md` — e.g. `auth.sign_up` → `specs/auth/sign_up.md`.
2. Use [`specs/TEMPLATE.md`](./specs/TEMPLATE.md) as the starting point. Remove sections that don't apply.
3. The validator enforces that every spec file maps to a real feature ID. Orphaned spec files fail CI.

Focus on what is observable: inputs, outputs, side effects, error conditions. Avoid language-specific function signatures.

## SDK compliance (not in this repo)

If you're here to update which features your SDK supports, you're in the wrong place — compliance lives in the SDK repo, not here. See the [SDK compliance](./README.md#sdk-compliance) section of the README for the `sdk-compliance.yaml` format and the reusable workflow to opt in to validation.

## Local development

```bash
cd scripts/capability-matrix
npm ci

npm test                           # vitest suite for the validator
npm run typecheck                  # tsc --noEmit
npm run validate                   # schema + structural checks (no network)
npm run report                     # parity report as JSON
npm run validate-compliance <file> # validate a sdk-compliance.yaml against the canonical spec
npm run aggregate                  # fetch all SDK compliance files → site/compliance.json
npm run build-site                 # render the static site to site/index.html
```

Run `npm test` and `npm run validate` before opening a PR. CI runs the same checks plus spec file validation.

## Pull requests

- Keep PRs focused — capability additions, spec additions, and tooling changes are best split into separate PRs.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles.
- Describe the user-visible change in the PR body. For new features, link the relevant Supabase docs or upstream server endpoint when applicable.
- CI must pass before merge. Reviews are routed via [CODEOWNERS](./CODEOWNERS).

### Commit types we use

| Type | When to use |
|---|---|
| `feat` | A new capability, new spec, or a new feature in the validator/site. |
| `fix` | A bug fix in the validator, site, schema, or a correction to capability data. |
| `docs` | Documentation-only changes (README, CONTRIBUTING, spec files). |
| `chore` | Maintenance that doesn't change behavior — deps, tooling config, repo housekeeping. |
| `refactor` | Code change in `scripts/` that neither fixes a bug nor adds a feature. |
| `test` | Adding or updating tests in `scripts/capability-matrix/test/`. |
| `ci` | Changes to GitHub Actions workflows under `.github/workflows/`. |

Breaking changes (e.g. renaming a feature ID, changing the schema in an incompatible way) must be flagged with `!` after the type: `feat!: rename auth.signup → auth.sign_up`.

## Code of conduct

Please be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) in spirit — assume good faith, keep feedback specific and actionable, and help newcomers find their footing.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
