# Upsert Rows

Inserts one row or many rows, resolving a conflict on a unique constraint instead of failing.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#upsert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#upsert)

- `POST /{relation}?on_conflict={columns}`

## Behavior

An [insert](insert.md) plus a conflict target and a resolution. Every insert behavior applies
unchanged, including `columns` and `defaultToNull`.

**Conflict target.** `on_conflict` names the unique index's columns, comma-separated; absent, the
primary key is used. It applies to every row in the request, and one request may mix merged and
inserted rows.

A relation with no unique constraint has nothing to collide on. Implementations SHOULD make that
unrepresentable — requiring a declared key for the derived-target form, an explicit target otherwise.

**Resolution.**

| `Prefer: resolution` | Effect on a colliding row |
| -------------------- | ------------------------- |
| `resolution=merge-duplicates` | updated with the supplied values |
| `resolution=ignore-duplicates` | left unchanged |

An upsert MUST always send one: with the header absent the request is an ordinary insert, and a
colliding row fails with `23505`. Implementations MUST expose both, defaulting to
`merge-duplicates`. Spelled as a boolean, the option is named `ignoreDuplicates`, defaulting to
false.

**Prefer header.** An upsert always carries `resolution=`, plus `return=`, `count=` and `missing=` as
requested. Implementations MUST merge by replacing only the entry with the matching key — replacing
the whole header drops `resolution=` and silently turns the upsert into an insert.

## Errors

- `PGRST204` — a column named in the payload, in `columns`, or in `on_conflict` does not exist
- `42P10` — the `on_conflict` columns do not match a unique constraint
- `23505` — unique violation other than the conflict target, or the resolution was not sent

## Related

- [Insert Rows](insert.md) — the same write without conflict resolution
