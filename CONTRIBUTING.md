# Contributing to the Supabase SDK Capability Matrix

> [!IMPORTANT]
> **Only repository collaborators can open pull requests here.**  
> This repository is public so you can see how we design and build the Supabase client SDKs, but the packages in it are internal tooling for the Supabase SDK team.
> We appreciate your interest in contributing. Please direct it at our other [`supabase`](https://github.com/orgs/supabase/repositories?q=visibility%3Apublic+archived%3Afalse) and
> [`supabase-community`](https://github.com/orgs/supabase-community/repositories?q=visibility%3Apublic+archived%3Afalse) repositories, which welcome community pull requests.

Thanks for your interest in contributing. This repo is the canonical, machine-readable record of which features exist across Supabase client SDKs. It is a **pure feature registry**: it defines what features exist and what they mean. Per-SDK compliance is declared in each SDK's own repo (see [README](./README.md#sdk-compliance)).

## Ways to contribute

- **Add or update a capability** in `packages/capability-matrix/capabilities/<area>.yaml`
- **Document what the SDK layer adds** to a feature with a spec file under `packages/capability-matrix/specs/<area>/<group_namespace>/<method_stem>.md`
- **Improve the validator or site generator** in `packages/capability-matrix/`
- **Report a bug or request a change** via [GitHub Issues](https://github.com/supabase/sdk/issues)

For security issues, please follow [SECURITY.md](./SECURITY.md) instead of filing a public issue.

## Before you start

- Search existing issues and open PRs to avoid duplicating work.
- For non-trivial changes (new product area, schema change, renaming a feature ID), open an issue first so we can align on scope. Feature ID renames are breaking for any SDK that already references the ID in its `sdk-compliance.yaml`.

## Adding or updating a capability

1. Open the YAML for the relevant area under `packages/capability-matrix/capabilities/` (or create a new area file matching `packages/capability-matrix/schema/capability-matrix.schema.json`).
2. Add or edit a feature entry. Required fields:
   - `id` — `<area>.<group_namespace>.<method_stem>` (e.g. `auth.sign_in.sign_in_with_password`). Must be unique and stable.
   - `name` — human-readable title.
   - `description` — one or two sentences explaining what the feature does.
   - `group` (optional) — the group ID this feature belongs to within the area.
3. Keep features SDK-agnostic. Describe observable behavior, not a specific language's API shape.
4. If you need a new group, add it under `groups:` at the top of the area file.

### Choosing a feature ID

- Three lowercase snake_case segments, `<area>.<group_namespace>.<method_stem>`: `auth.mfa.enroll`, `storage.file_buckets.upload`. The schema rejects anything else.
- Prefer the verb-object pattern users will recognize from the docs.
- For admin or scoped variants, namespace explicitly: `auth.admin.delete_user`.
- Once a feature ID ships, treat it as a public contract. Renames require coordinated updates in every SDK's `sdk-compliance.yaml`.

## Adding a spec file

Spec files are optional. They are free-form prose for humans and LLMs, and they are additive: the service's API spec is the source of truth for the wire (paths, request and response shapes, status codes, and error codes), and a spec file adds only what an SDK implementer cannot get from it. That means what the SDK layer does between the app and the wire, and what would surprise someone who has read the API spec and nothing else.

1. Create `packages/capability-matrix/specs/<area>/<group_namespace>/<method_stem>.md`, mirroring the three segments of the feature ID: `auth.sign_in.sign_up` → `specs/auth/sign_in/sign_up.md`. The validator and the site only see files at that depth.
2. Use [`specs/TEMPLATE.md`](./packages/capability-matrix/specs/TEMPLATE.md) as the starting point. Remove sections that don't apply.
3. The validator enforces that every spec file maps to a real feature ID. Orphaned spec files fail CI.

Write what the SDK adds: defaults it fills in, state it keeps, validation it should do before the wire, how it reshapes the response, what must happen first, and server behavior that surprises. Do not restate request or response fields, status codes, or error codes. Link the API spec instead. Avoid language-specific function signatures. Before opening the PR, delete every sentence an implementer could reconstruct from the linked API spec. If only the API section is left, the feature does not need a spec file.

## SDK compliance (not in this repo)

If you're here to update which features your SDK supports, you're in the wrong place — compliance lives in the SDK repo, not here. See the [SDK compliance](./README.md#sdk-compliance) section of the README for the `sdk-compliance.yaml` format and the reusable workflow to opt in to validation.

## Local development

```bash
cd packages/capability-matrix
bun install

bun test                           # test suite for the validator
bun run typecheck                  # tsc --noEmit
bun run validate                   # schema + structural checks (no network)
bun run report                     # parity report as JSON
bun run validate-compliance <file> # validate a sdk-compliance.yaml against the canonical spec
bun run aggregate                  # fetch all SDK compliance files → site/compliance.json
bun run build-site                 # render the static site to site/index.html
```

`bun run aggregate` uses `GITHUB_TOKEN` when it is set. Without one it falls back to anonymous requests, which GitHub limits to 60 per hour per IP address.

Run `bun test`, `bun run format-and-lint`, `bun run knip`, and `bun run validate` before opening a PR. CI runs the same checks plus spec file validation.

## Pull requests

- Keep PRs focused on one concern. A new capability and its spec belong in the same PR and the same `feat` commit. A spec on its own, new or changed, is `docs`. Unrelated capabilities and tooling changes get their own PRs.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles.
- Describe the user-visible change in the PR body. For new features, link the relevant Supabase docs or upstream server endpoint when applicable.
- CI must pass before merge. Reviews are routed via [CODEOWNERS](./CODEOWNERS).

### Commit types we use

| Type       | When to use                                                                             |
| ---------- | --------------------------------------------------------------------------------------- |
| `feat`     | A new capability, or a new feature in the validator/site.                               |
| `fix`      | A bug fix in the validator, site, schema, or a correction to capability data.           |
| `docs`     | Documentation-only changes: spec files, README, CONTRIBUTING, CLAUDE.md, skills.        |
| `chore`    | Maintenance that doesn't change behavior — deps, tooling config, repo housekeeping.     |
| `refactor` | Code change in a package under `packages/` that neither fixes a bug nor adds a feature. |
| `test`     | Adding or updating tests in `packages/capability-matrix/test/`.                         |
| `ci`       | Changes to GitHub Actions workflows under `.github/workflows/`.                         |

Breaking changes (e.g. renaming a feature ID, changing the schema in an incompatible way) must be flagged with `!` after the type and scope: `feat(auth)!: rename auth.sign_in.signup → auth.sign_in.sign_up`.

### Scopes

The scope names the part of the repository a change touches:

- Registry content (`capabilities/<area>.yaml` and `specs/<area>/`): the area, as in `feat(auth)` or `docs(storage)`. The changelog is per package, so the area is what tells its reader which part of the registry moved.
- A package's own tooling, tests, or documentation: the package directory name, as in `fix(postgrest-typegen)` or `docs(capability-matrix)`.
- Anything outside a package (root documentation, workflows): no scope, as in `docs:` or `ci:`.

Use one scope, and do not coin sub-package scopes such as `site`, `parsers`, or `schema`: they drift into synonyms and mean nothing in a changelog. Dependabot's `chore(deps)` is its own convention and stays.

## Code of conduct

Please be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) in spirit — assume good faith, keep feedback specific and actionable, and help newcomers find their footing.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
