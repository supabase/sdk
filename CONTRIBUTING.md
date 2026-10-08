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

Write what the SDK adds: defaults it fills in, state it keeps, checks it makes before the wire, how it reshapes the response, what must happen first, and server behavior that surprises. Do not restate request or response fields, status codes, or error codes. Link the API spec instead. Avoid language-specific function signatures.

A spec is normative. It states what an SDK does, in the present tense, for every SDK at once, and it never names an SDK or records what any SDK does today. A snapshot of current behavior rots the day one SDK changes, and it tells an implementer nothing about what to build. Kinds of SDK are fine, such as "SDKs that hold a session", but instances are not. When a named SDK diverges from a spec, open an issue in that SDK's repository that cites the spec as the source of truth, and leave the spec alone.

Every sentence is precise enough that two implementers would build the same thing. Name the input, the exact server answer (HTTP status, `error_code`, and the message when it carries meaning), the form a check accepts, and the body a response carries. Words like "malformed", "invalid", "clear", "appropriate", and "handles" usually mark a sentence that names none of those. This sentence, from an earlier version of a spec in this repository, fails both rules:

> The server answers a malformed path id with 404 rather than 400. The existing SDKs validate the id as a UUID before sending, which turns that into a clear client-side error.

It names no input, no error, and no form, and what it does say about SDKs is a snapshot. The same fact as a contract:

> A user id that is not a UUID is rejected before any request is sent, as the SDK's own argument error and never as the server error type. The server's answer to such an id is HTTP 404 with error code `validation_failed` and the message `user_id must be an UUID`, the same status an unknown user gets with `user_not_found`, so code that branches on the status would read a typo as a missing user. SDKs accept at least the canonical hyphenated form, 32 hexadecimal digits in groups of 8, 4, 4, 4, and 12, in either case.

A check the SDK makes before the wire is defined under `## Errors`, not `## Behavior`, in those terms: the input, the form it accepts, the error the SDK raises, and the server answer it pre-empts.

The service's behavior is not the spec's subject. A sentence about the service earns its place only as the premise of what the SDK does, in the same sentence as the obligation: "the body is an empty object, so the SDK returns nothing". What the service does beyond that is linked, never described: the guide on [supabase.com/docs](https://supabase.com/docs) when one covers it, otherwise the handler in the service's source. A spec that explained what a hard delete removes, what blocks it, and how a soft delete obfuscates the email was describing the service, and an implementer who needs those facts reads the guide, which owns them and is maintained by the people who change them.

When the API spec is wrong or incomplete for an operation, the `## API` section says so in one line, as a fact, and links the handler in the service's source. The condition that retires that line goes in an HTML comment directly below it, with the upstream issue URL, never in the prose: "until it is corrected" is noise to the reader and undermines the sentence it hangs off. When the API spec is fixed, delete the line and its comment together.

Before opening the PR, apply four tests to every sentence. Removal: delete it if an implementer could reconstruct it from the linked API spec, and if only the API section is left, the feature does not need a spec file. Snapshot: delete it if it names an SDK or describes what SDKs do today. Precision: rewrite it if two implementers could read it and build different things. Service: delete it if it describes the service and removing it changes nothing about what the SDK does, linking the guide or the handler if a reader would still need the fact. Then search `specs/` for the same wording in sibling files, because specs copy from each other and a fix to one is a fix to all of them.

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
