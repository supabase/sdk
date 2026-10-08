---
name: capability-matrix
description: Helps maintain the Supabase SDK capability matrix in packages/capability-matrix/capabilities/*.yaml and specs/ — naming a new feature ID, picking or creating a group, checking for duplicate or semantically-overlapping capabilities, spotting naming drift within a group, suggesting when a spec file is warranted, reviewing a spec for normative voice and precision, and noting platform-specific behavior. Use whenever a capability YAML or spec file is being added or edited, before opening a PR that touches capabilities/, or when asked to review/audit the matrix, check for duplicates, or suggest groupings. This is an advisory pass, not a gate — it complements `bun run validate`, it doesn't replace it.
---

# Capability Matrix Maintenance

This repo is the canonical registry of features across Supabase's client SDKs
(`capabilities/*.yaml`). The JSON Schema and `bun run validate` already catch
everything mechanical: malformed IDs, area/filename mismatches, exact
duplicate IDs, orphaned spec files. What they can't catch is judgment —
whether a new feature is *actually* new, whether its name reads naturally
next to its siblings, whether it's filed under the right group. That
judgment is what this skill provides.

This is a local, advisory pass. There is no CI bot version of this — findings
are suggestions for the person editing the file to accept, adjust, or ignore.
Don't present anything as a hard requirement.

## Step 0: run the mechanical checks first

Before spending any judgment calls, run the deterministic validator so you're
not duplicating what it already guarantees:

```bash
cd packages/capability-matrix && bun run validate
```

This confirms schema conformance, `area` field matches the filename, IDs
follow the `<area>.<group_namespace>.<method_stem>` pattern, no two features
share an exact ID, and every spec file maps to a real feature. If this
fails, fix that first — the checks below assume a structurally valid file.

## Step 1: read for context, not just the diff

Read the *whole* target area file (`capabilities/<area>.yaml`), not just the
new/changed entry — group names and sibling features are the only baseline
for judging naming and grouping consistency. If the new feature could
plausibly overlap another area (e.g. something touching both `realtime` and
`database`, or `client` and `auth` session handling), skim that file too.

## Step 2: semantic duplicates

`bun run validate` only catches identical IDs. Read every feature's `name` +
`description` in the same area (and group, if cross-area overlap looks
possible) and ask: does this describe behavior another entry already
covers, just worded differently? Common patterns to watch for:

- Same underlying API call described from two angles (e.g. a "set" feature
  and a separate "update" feature that hit the same endpoint)
- A new entry that's actually a narrower case of an existing one (should it
  be a note on the existing feature instead of a new ID?)
- Copy-pasted description with only the verb changed

If you find a likely duplicate, name both IDs and describe the overlap —
don't assume which one should win; that's the author's call.

## Step 3: naming consistency

The schema enforces the `<area>.<group>.<method>` shape via regex, but not
whether the words chosen fit. Compare the new feature's `id`/`name` against
its siblings in the same `group`:

- Verb choice — if the group already uses `create`/`delete`/`list` for
  parallel operations, a new `add_x` or `remove_x` reads inconsistent.
  (See `CONTRIBUTING.md`'s "Choosing a feature ID" section for the
  verb-object convention.)
- Admin/scoped variants should be namespaced the way existing ones are
  (`auth.admin.delete_user`, not `auth.delete_user_admin`).
- `name` (the human-readable title) should match the tone of sibling
  entries in the same group — not suddenly more/less verbose or technical.

## Step 4: grouping

- Does the feature's `group` field point to a group that actually fits, or
  is it forcing a fit into the nearest existing one? If several recent
  features don't cleanly fit any group, say so and suggest a new group
  entry under `groups:` at the top of the file.
- Conversely, flag a group that's accumulated features with little in
  common — that's a sign it should split.
- A feature with no `group` at all is valid (it's optional) but worth a
  second look — is that intentional, or was a fitting group just missed?

## Step 5: spec suggestion

Spec files (`specs/<area>/<group_namespace>/<method_stem>.md`) are optional
and additive. The service's API spec owns the wire: paths, request and
response shapes, status codes, and error codes. A spec file earns its place
only when the SDK layer has something to say that the API spec cannot:
defaults the SDK fills in, state it keeps, validation it should do before
the wire, how it reshapes the response, sequencing across capabilities, or
server behavior that would surprise someone who has read the API spec
alone. The number of fields or error codes an operation has is not a reason
for a spec, because they are in the API spec already. The directory always
mirrors the feature `id`'s own segments, so `auth.mfa.challenge` lives at
`auth/mfa/challenge.md`, regardless of what that feature's optional `group`
field currently says. The two can diverge when a feature has been regrouped
for display without renaming its `id`. If the new feature's `description`
hints at SDK-layer complexity and no spec exists, suggest creating one from
`specs/TEMPLATE.md`. Don't suggest a spec for a feature whose API spec entry
already tells an implementer everything.

When a spec file is being added or edited, read it against the API spec it
links and flag every sentence that restates it: field lists, status code
tables, error code catalogs, descriptions of what the service does
internally. Each one is a candidate for deletion with a link in its place.
If that removal leaves only the API section, suggest dropping the file.

Then read what survives for voice and precision, which no validator can see. These checks exist because specs in this repository have failed each of them before, and the failures read plausibly until someone tried to implement from them.

- Snapshot test. A spec is normative: it states what an SDK does, in the present tense, for every SDK at once. Flag every sentence that names an SDK (`supabase-js`, `JS`, `Swift`, `Dart`, `Python`) or describes what SDKs do today ("the existing SDKs", "currently", "most SDKs"). Kinds are fine ("SDKs that hold a session"), instances are not. A sentence describing how one SDK diverges is never spec content: suggest an issue in that SDK's repository that cites the spec, and delete the sentence.
- Precision test. Flag every sentence two implementers could read and build differently. Server behavior names the HTTP status, the `error_code`, and the message when it carries meaning. A check before the wire names its input, the form it accepts, the error the SDK raises, and the server answer it pre-empts. "Malformed", "invalid", "clear", "appropriate", "properly", and "handles" are the usual tells: "a malformed id gets a clear client-side error" names no input, no form, and no error.
- Expiry test. Flag any sentence whose truth has a date on it ("until it is corrected", "not yet", "currently"). The fact stays in the prose and the condition that retires it moves to an HTML comment directly below, with the upstream issue URL, which is the form the template gives for API drift pointers.
- Service test. Flag every sentence that describes the service rather than what the SDK does with it. Service behavior is spec content only as the premise of an SDK obligation, in the same sentence ("the body is an empty object, so the SDK returns nothing"). If deleting the sentence changes nothing about what the SDK does, it goes, and if a reader would still need the fact, a link to the guide on supabase.com/docs, or to the handler when no guide covers it, takes its place. What a delete removes, what blocks it, and how a soft delete obfuscates a row are the guide's to own.
- Placement. A check the SDK makes before the wire is defined under `## Errors`, not `## Behavior`.
- Evidence. For every status, code, message, and server behavior the spec names, find the line in the service's handler that produces it, at a commit, before accepting the sentence. Do not take the API spec's word for a response body: "the server returns the deleted user" is the kind of claim that reads plausibly, is documented upstream, and is false.
- Siblings. When a sentence fails any test, search `specs/` for the same wording. Specs copy from each other, and the fix is one PR for all of them, not a fix to the file in front of you.

## Step 6: platform-scope notes

There is no schema field for "this only applies to mobile/web SDKs" — that
nuance (biometric auth, secure enclave storage, browser-only APIs like
`localStorage`) is expected to live in prose, not structured data. If a
feature's behavior is inherently platform-scoped, suggest a line either in
the feature's `description` or, if it has a spec, in the spec's `## Notes`
section. Point out *why* it matters: SDKs that don't apply can declare
`not_applicable` in their `sdk-compliance.yaml`, but only if the constraint
is documented somewhere a maintainer would see it.

## Presenting findings

Group findings by step, lead with the ones most likely to need a real
change (duplicates, then naming, then grouping, then spec/platform notes).
For each finding, name the specific IDs involved and explain the reasoning
in one or two sentences — enough for the author to judge it themselves.
Skip steps that have nothing to report; don't manufacture a finding to fill
out every section. If everything looks clean, say so briefly and move on.
