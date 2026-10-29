# Supabase SDK Getting Started

How the Supabase SDK team builds client SDKs: the principles we work by, the rules we
follow, and the steps for common tasks. It applies to every client SDK repository
(JavaScript, Swift, Flutter, Python, Go, C#, Kotlin).

This tier is about how we work. What each feature does is in the
[capability registry](../../packages/capability-matrix/capabilities/) and the
[feature specs](../../packages/capability-matrix/specs/).

## Who reads this

Humans and agents read the same pages. Neither gets a private copy.

- **Humans**: read the principles once, and read a standard when your change touches it.
- **Agents**: load this index first, then load only the pages your task needs. Cite a
  rule by its ID in findings and PR descriptions.

## Layers

Three layers of rules apply to an SDK change. Each layer adds to the one above it and
does not repeat it.

| Layer | Where | Scope |
| --- | --- | --- |
| Supabase code standards | `engineering-standards:code-standards` skill in `supabase/agent-os` | Every Supabase repository: code quality, PR size, review, AI policy |
| SDK Getting Started | This folder | Every client SDK repository |
| Repository instructions | `AGENTS.md` and `CONTRIBUTING.md` in each SDK repository | One repository: commands, layout, local conventions |

When two layers conflict, the more specific layer wins inside its scope. The page that
deviates states the deviation and the reason.

## Cite a rule

Each `##` heading in a standard is one rule. Its ID is the page path without `.md`,
then `#`, then the heading slug:

```
standards/spec-first#capability-before-code
```

A heading slug never changes. A rule that is no longer valid is marked deprecated and
keeps its heading.

## Requirement levels

Standards use **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** as
defined in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119). A rule with no keyword
is information, not a requirement.

## Status

Each standard and playbook has a `status` and a `version` in its frontmatter.

| Status | Meaning |
| --- | --- |
| `draft` | Under discussion. Follow it, and comment on it, but expect changes. |
| `candidate` | Agreed by the team. Changes come from use, not from first opinions. |
| `stable` | The rule. Version `1.0.0` or higher. |
| `deprecated` | Do not follow. The page names its replacement. |

## Pages

- [principles.md](principles.md): thirteen engineering principles that the standards
  apply, starting with thin clients, logic, validation, and defaults in the server, and
  decoding that accepts new values. Read once.
- [standards/spec-first.md](standards/spec-first.md) (`draft`): a change to SDK
  behavior starts with a capability, and a spec when needed, in `supabase/sdk`.

Planned, in order:

- `standards/compatibility.md`: forward compatibility with services, runtime support
  table, end-of-life policy.
- `standards/api-design.md`: public API, naming across SDKs, approval by the SDK's lead
  maintainer.
- `standards/repository.md`: required files and CI checks in every SDK repository.
- `templates/agents-md.md`: the `AGENTS.md` template.
- `playbooks/implementing-a-capability.md`, `playbooks/triaging.md`,
  `playbooks/cutting-a-release.md`, `playbooks/handling-a-regression.md`.
- `standards/release-versioning.md`, `standards/triage-response.md`,
  `standards/testing.md`, `standards/breaking-changes.md`,
  `standards/spec-lifecycle.md`.
- `philosophy.md`.

## Change a page

Open a pull request in `supabase/sdk`. Use the commit type `docs`, with no scope. A
change to a standard adds a `changelog` entry and bumps its `version`:

- **Patch**: a clarification that changes no requirement.
- **Minor**: a new rule.
- **Major**: a change to the meaning of an existing rule, or its removal. Before
  `stable`, the version stays `0.x` and such a change bumps the minor.
