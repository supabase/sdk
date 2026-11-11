# Principles

These principles guide every change to a Supabase SDK. When no spec or written rule
covers a case, use them to decide, and then write the decision down.

The [Supabase code standards](https://github.com/supabase/agent-os/blob/main/plugins/engineering/engineering-standards/code-standards/SKILL.md)
(`engineering-standards:code-standards` in `supabase/agent-os`) already cover ownership
of code, PR size, review, test plans, and AI use. This document does not repeat them.
It adds what is special to SDKs.

The principles come in two groups. [SDK design](#sdk-design) covers what users of an
SDK see. [How we work](#how-we-work) covers how the team builds the SDKs.

## SDK design

### Clients are thin layers

An SDK is a thin layer over the Supabase services. It turns a service's API into calls
that feel native in the language, and it keeps the state that only the client can
hold (for example the session, the Realtime connection or the user's configuration).
It does not add its own product on top.

A feature that one SDK adds on top of the service should not live only in that SDK.
Users of the other SDKs ask for it too. Then every SDK must build, test, and maintain
the same feature, or the SDKs drift apart.

Example: when users want a helper that combines two service calls into one workflow,
the helper goes in an example or a guide, not into the client.

### Logic belongs in the service

When logic can run in the service, it runs in the service. Put logic in the client only
when it must run there:

- it keeps client state, such as the stored session or the Realtime subscriptions
- it needs a platform API, such as secure storage or app lifecycle events
- it must run before data leaves the user's app

The reason is reach. A change in the service reaches every user at once, including
users who never upgrade their SDK. A change in the client reaches users only after each
SDK ships a release and each user upgrades. Old SDK versions stay in use for years.

Example: a user asks the SDK to filter a Storage file list by size, and the service has
no such filter. The SDK does not fetch every file and filter the list in the client.
The request becomes an issue in the service's repository.

### Validation belongs to the service

The service validates its input. The SDK sends the request and returns the service's
answer as an error. It does not check the input first.

Validation here means any check on a value that the service also judges: an empty
string, a number out of range, a string format, a size limit, a required field.

The reason is that a rule copied into the SDK is a second copy. When the service changes
the rule, every SDK is wrong until it ships a new release, and users on old versions
stay wrong. A value that the service rejects today, such as an empty string, may be
allowed tomorrow.

Example: the service accepts a payload of at most 5 MB. The SDK does not check the size
before it sends the request. The service rejects a larger payload, and the SDK returns
that error. If the service raises the limit to 10 MB, every SDK version, old and new,
accepts the larger payload on the same day.

A check before the request is a rare exception, not a pattern to repeat. It is allowed
only when a spec defines it and states how the service's own answer would mislead the
caller, for example a malformed ID that the service answers with the same status as a
missing record. "The service would reject it anyway" and "the SDK can give a clearer
error" are not reasons. Without such a spec, the SDK does not check.

### The service owns its defaults

When the service has a default for a field that a request does not require, the SDK
does not send that field unless the user sets it. The SDK option has no value by
default (`nil`, `null`, `None`, `undefined`), and the SDK leaves an unset option out of
the request. The service then applies its own default. A default that an SDK copies is
a second copy of a service rule. When the service changes it, users get the old value
until every SDK ships a release and every user upgrades.

This applies to values that the service reads. An option that only the client reads,
such as the session storage or the auto refresh of tokens, has its default in the SDK.

Example: the service creates a bucket as private when the request has no `public`
field. The SDK's `public` option has no value by default. When the user does not set it,
the request has no `public` field, and the service decides. When the user sets it to
`false`, the request sends `false`. If the service changes its default, every SDK
version, old and new, follows on the same day.

### Decoding is open to new values

The service adds values over time: a new field, a new enum value, a new event type, a
new error code. An SDK does not fail when a response contains a value that it does not
know. It ignores a field that it does not know. It decodes an enum value that it does
not know into a form the user can read, such as an "unknown" case that keeps the raw
value, and it does not raise an error. It returns an error code that it does not know as
the service sent it. A new value in the service then works with old SDK versions, and a
later SDK release adds full support for it.

This applies to values that the SDK decodes from a service response. A type that the
SDK defines and emits itself, such as its auth state events, can be closed.

Example: the service adds a new factor type to the list of a user's MFA factors. An SDK
that knows only `totp` and `phone` still decodes the list. The new factor appears with
its raw type, and the calls that do not use it keep working.

### Convenience over configuration

A client works with good defaults and the fewest inputs: the project URL and a key.
Each new option is one more test case, one more docs entry, and one more way for
the SDKs to differ. Add an option only when a real user cannot reach their goal
without it. Keep the escape hatches that let users solve the rest themselves: a custom
HTTP client, global headers, custom session storage.

Example: a request for an option that changes one default for one use case is answered
with the custom HTTP client or a custom header, not with a new option.

### One concept, many idioms

A user who knows one Supabase SDK recognizes the same concepts, names, and defaults in
another. Each SDK still feels native to its language: its own types, error style, and
async model. The spec fixes the concept. The SDK chooses the expression.

Example: a spec says that the SDK returns nothing when the service answers with an
empty body. It does not name the return type. Each SDK uses the empty return that its
language expects.

## How we work

### The registry is the contract

A feature exists when it has a capability ID in `supabase/sdk`. An SDK implements it
when its `sdk-compliance.yaml` says so and CI agrees. A feature in one SDK with no
capability ID is invisible: no other SDK knows to build it, and no one can check it.

Example: a new public method that is not listed under a capability's `symbols` or
`supporting_symbols` fails the public API check in the SDK repository. The fix is to
list it under the capability it belongs to, or to add a capability when none fits. It
is not an exception.

### Spec before code

Agree on the behavior before you write it. For SDK behavior, the agreement is a merged
capability, and a spec file when the SDK adds behavior beyond the service's API.
Shipped code that each SDK built differently is expensive to fix, because a fix can
break users who depend on the shipped behavior.

Example: a fix that changes what a method returns, when a spec describes that return,
is a behavior change. It starts with a spec change, even when the code change is one
line.

### Divergence is fixed in the SDK, not in the spec

When an SDK does not match a spec, open an issue in that SDK's repository and cite the
spec. Change a spec only when the spec is wrong, and say why in the PR. A spec that
follows whichever SDK changed last stops being a contract.

Example: an earlier spec said "the existing SDKs validate the ID". That sentence
described what some SDKs did that day. It was rewritten as a contract that every SDK
follows. An SDK that does not follow it gets an issue, and the spec stays as it is.

### Automate the obvious, judge the nuanced

If a check can enforce a rule, a check enforces it: the registry validator, the public
API check, lint. The drift check warns about registration drift but does not block a
PR. Human review time goes to what a check cannot judge: API design, behavior, and user
impact.

Example: reviewers do not check that new public symbols are registered. The public API
check fails the PR when one is missing.

### Tests prove behavior across the boundary

A change that crosses a real boundary gets an integration test against a real service:
HTTP to a Supabase service, a Realtime socket, an auth session flow, a storage upload,
a PostgREST query. Unit tests prove the logic. Only an integration test proves that the
SDK and the service agree.

Example: a token refresh fix has unit tests for the timer, and an integration test that
refreshes a real session against a local stack.

### If it is not written, it is not a rule

A decision made in Slack, a meeting, or one person's skill file binds no one until it is
in an issue, a spec, or these documents. Agents cannot read a hallway conversation, and
new team members were not there.

Example: the rule that a behavior change needs a spec first lived only in one agent
skill. It is now [Spec before code](#spec-before-code) in this document, so every human
and every agent follows the same text.
