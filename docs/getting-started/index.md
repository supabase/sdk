# Supabase SDK Getting Started

How the Supabase SDK team builds client SDKs, starting with the principles we work by.
It applies to every client SDK repository (JavaScript, Swift, Flutter, Python, Go, C#,
Kotlin).

This tier is about how we work. What each feature does is in the
[capability registry](../../packages/capability-matrix/capabilities/) and the
[feature specs](../../packages/capability-matrix/specs/).

## Who reads this

Humans and agents read the same pages. Neither gets a private copy.

- **Humans**: read the principles once.
- **Agents**: load this index first, then load only the pages your task needs. Cite a
  principle by its ID in findings and PR descriptions.

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

## Cite a principle

Each `##` heading in [principles.md](principles.md) is one principle. Its ID is the
page path without `.md`, then `#`, then the heading slug:

```
principles#validation-belongs-to-the-service
```

A heading slug never changes. A principle that no longer applies is marked deprecated
and keeps its heading.

## Pages

- [principles.md](principles.md): the engineering principles, starting with thin
  clients, logic, validation, and defaults in the server, and decoding that accepts new
  values. Read once.

## Change a page

Open a pull request in `supabase/sdk`. Use the commit type `docs`, with no scope.
