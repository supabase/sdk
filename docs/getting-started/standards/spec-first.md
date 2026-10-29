---
status: draft
version: 0.1.0
applies_to: all
changelog:
  - version: 0.1.0
    date: 2026-10-29
    summary: Initial draft, from the rule in the SDK harness conventions
---

# Spec First

A change to what an SDK does for its users starts in `supabase/sdk`, not in the SDK.
The capability registry names the feature. A spec file, when one is needed, states what
the SDK layer adds. The SDK change follows the merged result.

This standard applies to humans and agents alike, in every client SDK repository.

Principles: [The registry is the contract](../principles.md#the-registry-is-the-contract),
[Spec before code](../principles.md#spec-before-code).

## Changes in scope

A change is in scope when it does one of these:

- adds a public API (a symbol that a user can call, import, configure, or subclass)
- adds a behavior that a user can observe
- changes a behavior that a capability or a spec already describes

These changes are out of scope, and need nothing in `supabase/sdk`:

- a bug fix that makes the SDK match its capability and spec
- an internal refactor with no change to public API or behavior
- tests, docs, build, CI, and dependency updates with no behavior change

A bug fix that makes the SDK match a spec **SHOULD** link the spec in the PR description.

Why: a reviewer can then check the fix against the contract, not against the author's
reading of it.

Enforced by: review.

## Capability before code

A change in scope **MUST** use a capability ID that exists in
`packages/capability-matrix/capabilities/` on the `main` branch of `supabase/sdk`. When
no capability fits, open a pull request in `supabase/sdk` that adds one, following
[Adding or updating a capability](../../../CONTRIBUTING.md#adding-or-updating-a-capability).

Work in the SDK **MAY** start in a draft PR before the capability merges, to test that
the design works. The SDK PR **MUST NOT** be marked ready for review until the
capability PR has merged.

Why: the capability ID is the name every SDK uses for the feature. When one SDK merges
first under its own name, the others build something different.

Enforced by: the compliance validation in the SDK repository rejects an unknown
capability ID, and the public API check fails when a new public symbol is not
registered under one.

## Spec file when the SDK adds behavior

A change in scope **MUST** come with a spec file when the SDK layer does more than the
service's API spec shows. Examples are defaults the SDK fills in, state it keeps, checks
it makes before the request, a response it reshapes, or an order of calls it requires.
The spec file follows [`specs/TEMPLATE.md`](../../../packages/capability-matrix/specs/TEMPLATE.md).

When the template's removal test leaves only the `## API` section, the capability entry
is enough, and no spec file is needed.

A new capability and its spec file go in the same pull request and the same `feat`
commit. A spec file on its own is a `docs` commit.

Why: two SDK engineers who read only the API spec build two different SDK layers. The
spec file is where the SDK layer is agreed.

Enforced by: review of the capability pull request. The validator checks that each
spec file maps to a real capability ID.

## Spec change before behavior change

A change to a behavior that a spec file describes **MUST** update the spec file first,
in its own pull request in `supabase/sdk`. The SDK pull request links it.

Why: if the SDK changes first, the spec describes the old behavior, and every other
SDK keeps building it.

Enforced by: review.

## Approval

A capability or spec pull request in `supabase/sdk` **MUST** have an approval from a
member of `@supabase/sdk` other than its author, through `CODEOWNERS`.

The public API that implements the capability in an SDK is approved separately, by
that SDK's lead maintainer. See `standards/api-design` (planned).

Why: the capability decides what every SDK builds. The SDK's API decides how one
language expresses it. Different people own the two decisions.

Enforced by: branch protection and `CODEOWNERS` in `supabase/sdk`.

## Register the implementation

The SDK pull request that implements a capability **MUST** update the SDK's
`sdk-compliance.yaml`: set the capability's status, and list its entry points under
`symbols`. A status of `partially_implemented` **MUST** have a `note` that says what is
missing.

Why: the compliance file is how every other reader, human or agent, learns that the
SDK has the feature.

Enforced by: the public API check (blocking) and the drift check (warning) in the SDK
repository.

## Divergence goes to the SDK

When an SDK does not match a merged capability or spec, open an issue in that SDK's
repository that cites the capability ID and the spec. Change the spec only when the
spec is wrong, and state the reason in the pull request.

Why: a spec that is edited to match one SDK stops being a contract for the others.

Enforced by: review of spec pull requests.

## Agents

An agent that implements an SDK change follows every rule above, and these two in
addition:

- When no capability fits the change, the agent **MUST** stop the implementation and
  propose a capability pull request in `supabase/sdk` instead.
- The agent **MUST** get a human's approval before it opens that pull request, because
  it is a public write.

Why: an agent can write the code faster than the team can agree on the behavior. The
stop puts the agreement first.

Enforced by: the SDK harness skills follow this page.

## Open questions

These are open while the status is `draft`. Each one becomes a rule or is removed
before `candidate`.

- Does an experimental or preview API, marked as such in the SDK, need a capability
  first?
- Does a platform-only feature with no counterpart in any other SDK need a capability,
  or only an entry in the SDK's own docs?
