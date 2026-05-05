# Supabase SDK Specifications

Stack-agnostic behavior contracts for Supabase client libraries. Specs in this repo are the single source of truth for how Supabase SDKs behave across all languages.

## Structure

```
specs/       # Behavior specifications (NNNN-<topic>.md)
skills/      # Claude Code skills for working with specs
scripts/     # Tooling for SDK team members
```

## Specs

| # | Topic | Status |
|---|-------|--------|
| [0001](specs/0001-postgrest-retry.md) | PostgREST — Automatic Retry | Draft |

## Writing a Spec

Install the `sdk-spec` skill (see below), then ask Claude to write a new spec. The skill enforces the format — RFC 2119 requirements, named scenario slugs, status lifecycle, and changelog.

New specs go in `specs/` with the next available number:

```bash
ls specs/ | sort | tail -1  # find next number
```

## Installing Skills

The `skills/` directory contains Claude Code skills for the SDK team. Install without cloning the repo:

```bash
# install all skills
curl -fsSL https://raw.githubusercontent.com/supabase/sdk/main/scripts/install-skills.sh | bash

# install a specific skill
curl -fsSL https://raw.githubusercontent.com/supabase/sdk/main/scripts/install-skills.sh | bash -s sdk-spec
```

Skills are copied to `~/.claude/skills/`. Restart Claude Code after installing.

## Spec Format

Every spec has seven sections in this order:

1. **Header table** — version, status, date, authors
2. **Abstract** — 2–3 sentence summary
3. **Definitions** — RFC 2119 boilerplate + domain terms
4. **Requirements** — normative behavior in `MUST`/`SHOULD`/`MAY` language, grouped as `R{n}.{m}`
5. **Scenarios** — named test cases (`slug`, Stimulus → Expected)
6. **Rationale** — non-normative explanation of non-obvious decisions
7. **Changelog** — version history

See [skills/sdk-spec/SKILL.md](skills/sdk-spec/SKILL.md) for the complete authoring guide.
