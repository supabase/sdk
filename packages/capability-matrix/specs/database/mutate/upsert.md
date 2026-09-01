# Upsert Rows

Inserts one row or many rows, resolving a conflict on a unique constraint instead of failing.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#upsert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#upsert)

- `POST /{relation}?on_conflict={columns}`

## Behavior

An upsert is an [insert](insert.md) plus a conflict target and a resolution. Every insert behavior
applies unchanged — payload shapes, the `columns` union for a ragged batch, the empty-collection
case, and the `defaultToNull` option.

### Conflict target

`on_conflict` names the columns of the unique index to detect a collision on, comma-separated. When
absent, the collision is resolved against the relation's primary key.

The target applies to every row in the request; a single request may mix outcomes, with some rows
merged or ignored and others inserted.

A relation with no unique constraint has nothing to collide on, which makes an upsert against it a
plain insert that appends a row on every call. Implementations SHOULD make that unrepresentable —
for example by requiring a declared key for the derived-target form and an explicit target otherwise.

### Resolution

| `Prefer: resolution`           | Effect on a colliding row        |
| ------------------------------ | -------------------------------- |
| `resolution=merge-duplicates`  | updated with the supplied values |
| `resolution=ignore-duplicates` | left exactly as it is            |

An upsert MUST always send one of these. There is no server-side default: with the header absent the
request is an ordinary insert and a colliding row fails with `23505`.

Implementations MUST expose both, defaulting to `merge-duplicates`. Where an SDK spells the choice as
a boolean it is named `ignoreDuplicates`, defaulting to false.

`ignore-duplicates` is insert-if-absent — a distinct operation rather than a variant, and the correct
choice for seeding or backfilling, where overwriting an existing row would lose data.

### Composing preferences

An upsert always carries `resolution=`, plus `return=`, `count=` and `missing=` as requested. These
are independent entries in one comma-separated `Prefer` header, and setting one MUST NOT drop
another — implementations MUST merge by replacing only the entry with the matching key.

Replacing the whole header to set `return=representation` drops `resolution=`, which silently turns
the upsert into an insert.

## Errors

- `PGRST204` — a column named in the payload, in `columns`, or in `on_conflict` does not exist.
- `42P10` — the columns named by `on_conflict` do not match a unique constraint on the relation.
- `23505` — a unique constraint other than the conflict target was violated, or the resolution
  preference was not sent.

## Related

- [Insert Rows](insert.md) — the same write without conflict resolution
