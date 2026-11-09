# Supabase SDK Engineering

How the Supabase SDK team builds client SDKs, starting with the principles we work by.
It applies to every official client SDK repository.

This tier is about how we work. What each feature does is in the
[capability registry](../packages/capability-matrix/capabilities/) and the
[feature specs](../packages/capability-matrix/specs/).

## Who reads this

This document and other documents in this folder are intended for reading by humans
and AI agents alike.

Agents load this README first, then load only the documents their task needs. They
cite a principle by a link to its heading in findings and PR descriptions.

## Layers

Three layers of rules apply to an SDK change. Each layer adds to the one above it and
does not repeat it.

| Layer                   | Where                                                                                  | Scope                                                               |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Supabase code standards | [`code-standards` skill][code-standards] in `supabase/agent-os`                        | Every Supabase repository: code quality, PR size, review, AI policy |
| SDK engineering docs    | `docs/` in `supabase/sdk`                                                              | Every client SDK repository                                         |
| Repository instructions | Each SDK repository's docs, such as `AGENTS.md`, `CONTRIBUTING.md` or `DEVELOPMENT.md` | One repository: commands, layout, local conventions                 |

[code-standards]: https://github.com/supabase/agent-os/blob/main/plugins/engineering/engineering-standards/code-standards/SKILL.md

When two layers conflict, the more specific layer wins inside its scope. The document
that deviates states the deviation and the reason.

## Cite a principle

Cite a principle with a link to its heading:

```
https://github.com/supabase/sdk/blob/main/docs/principles.md#validation-belongs-to-the-service
```

A heading never changes, so the link stays valid. A principle that no longer applies is
marked deprecated and keeps its heading.

## Documents

- [principles.md](principles.md): the engineering principles, starting with thin
  clients, logic, validation, and defaults in the server, and decoding that accepts new
  values.

## Change a document

Changes come through a pull request in `supabase/sdk`. Only repository collaborators can
open one there; see [CONTRIBUTING.md](../CONTRIBUTING.md). Use the commit type `docs`,
with no scope.
