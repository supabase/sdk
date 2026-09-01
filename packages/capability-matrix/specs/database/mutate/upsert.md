# Upsert Rows

Inserts one row or many rows, resolving a conflict on a unique constraint instead of failing.
Sent as `POST` with a conflict target and a resolution preference.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#upsert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#upsert)

- `POST /{relation}?on_conflict={columns}`

## Behavior

An upsert is an [insert](insert.md) plus a decision about what to do with a row that collides. It
inherits every insert behavior — the single-row versus collection payload, the `columns` union for a
heterogeneous batch, the empty-collection case — and adds a conflict target and a resolution.

### Conflict target

`on_conflict` names the columns of the unique index to detect a collision on, comma-separated. When
it is absent PostgREST resolves the collision against the relation's primary key.

The target only takes effect for a row that actually carries those columns in its payload. A row
that omits a database-generated key is inserted rather than merged, so a batch can mix the two.

A relation with no unique constraint has nothing to collide on, which makes an upsert against it a
plain insert that appends a row on every call. Implementations SHOULD make that unrepresentable
rather than silently misleading — for example by requiring a declared key for the derived-target
form, and requiring an explicit target otherwise.

### Resolution

`Prefer: resolution` is what makes a `POST` an upsert at all. It is not a tuning knob on top of
upsert behavior — there is no server-side default resolution, and PostgREST only resolves conflicts
when the header is present:

> You can make an upsert with `POST` and the `Prefer: resolution=merge-duplicates` header

| `Prefer: resolution`           | Effect on a colliding row        | SQL equivalent           |
| ------------------------------ | -------------------------------- | ------------------------ |
| absent                         | **request fails** — `23505`      | plain `INSERT`           |
| `resolution=merge-duplicates`  | updated with the supplied values | `ON CONFLICT DO UPDATE`  |
| `resolution=ignore-duplicates` | left exactly as it is            | `ON CONFLICT DO NOTHING` |

So an implementation's upsert MUST always send a resolution; omitting it does not fall back to
merging, it degrades the call to an ordinary insert. `merge-duplicates` is the resolution an SDK
SHOULD default to, being what "upsert" normally means — but that default belongs to the client, not
to the server.

`ignore-duplicates` is a distinct operation rather than a variant: insert-if-absent. It is the
correct choice for seeding reference data, backfilling, or any at-least-once job where overwriting a
row that someone has since edited would be data loss.

Implementations MUST expose both. Where an SDK spells this as a boolean it is named
`ignoreDuplicates`, defaulting to false.

### Missing columns: `null` versus `DEFAULT`

Identical to [insert](insert.md): a column named in `columns` but absent from a given row is
inserted as `null` by default, or takes the column's `DEFAULT` under `Prefer: missing=default`.
Implementations MUST expose this on upsert as well as insert, with the same default and the same
name (`defaultToNull`, defaulting to true).

### Composing preferences

An upsert carries at least `resolution=` and, once rows are requested back, `return=` — plus
optionally `count=` and `missing=`. These are independent entries in one comma-separated `Prefer`
header, and setting any one of them MUST NOT drop the others.

This is a load-bearing requirement rather than a stylistic one. An implementation that sets
`return=representation` by replacing the whole header drops `resolution=merge-duplicates`, and
PostgREST then treats the request as an ordinary insert — so asking for the merged row back turns
the upsert into an insert and returns a unique-constraint violation instead. The merge MUST replace
only the entry whose key matches.

## Errors

- `PGRST204` — a column named in the payload, in `columns`, or in `on_conflict` does not exist.
- `42P10` — the columns named by `on_conflict` do not match a unique constraint on the relation.
- `23505` — a unique constraint other than the conflict target was violated.

## Related

- [Insert Rows](insert.md) — the same write without conflict resolution
