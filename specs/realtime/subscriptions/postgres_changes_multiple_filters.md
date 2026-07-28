# Multiple Postgres Changes Row Filters

## Behavior

A single Postgres changes subscription accepts more than one PostgREST-style filter condition, combined with `AND`. Only rows matching every condition trigger an event.

The conditions are expressed as one comma-separated filter string passed to the same `postgres_changes` binding — not as multiple separate subscriptions and not as an array field. For example, `id=eq.200,name=eq.foo` matches rows where `id` is `200` AND `name` is `foo`.

This is a string-format capability, not a new wire message: the client passes the combined string through opaquely, and the Realtime server splits it on commas into individual `{column, operator, value, negate}` conditions before ANDing them into the underlying subscription query.

Supported per-condition operators: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `like`, `ilike`, `is`, `match`, `imatch`, `isdistinct`. Any operator can be negated with a `not.` prefix (e.g. `id=not.eq.5`).

## Prerequisites

Requires a Realtime server version that parses comma-delimited filter strings (older servers accept only a single condition per subscription).

## Errors

<!-- none named -->

## Notes

- Only `AND` semantics — there is no way to express `OR` across conditions within one filter string.
- The `in` operator accepts at most 100 values.
- Delete events cannot be filtered at all, regardless of filter count.
- Values containing `,`, `(`, `)`, `"`, or `\` must be double-quoted so they aren't misread as a delimiter or operator boundary.
- Unrelated to the `private` channel / RLS flag — combining filters works the same on public and private channels.

## Related

- [Postgres Changes Row Filter](realtime.subscriptions.postgres_changes_filter) — the single-filter form this extends
- [Private Channel (RLS)](realtime.subscriptions.private_channel)
