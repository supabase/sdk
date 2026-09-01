# Insert Rows

Inserts one row or many rows into a table or view.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert)

- `POST /{relation}`

## Behavior

Accepts a single row or a collection of rows, sent as a JSON object and a JSON array respectively.

### Bulk payloads with differing keys

A bulk payload sent **without** a `columns` query parameter requires every row to carry an identical
key set; any row that differs is rejected with `PGRST102`. Nothing is written.

Implementations whose row type omits absent values rather than encoding them as `null` therefore
produce ragged payloads routinely — a batch built by mapping over heterogeneous input. Such an
implementation MUST either:

- send `columns` naming the union of keys across all rows, which makes a ragged batch valid; or
- send rows verbatim and surface `PGRST102`, in which case the requirement that all rows share one
  key set MUST be documented on the method.

An empty collection is not an error; it writes nothing. Implementations MUST NOT emit `columns=""`
for it, which is rejected.

### Missing columns: `null` versus `DEFAULT`

Where `columns` names a column that a given row omits:

| `Prefer: missing` | Value written for that row |
| ----------------- | -------------------------- |
| absent (default)  | `null`                     |
| `missing=default` | the column's `DEFAULT`      |

Implementations MUST expose this as a first-class option, named `defaultToNull` and defaulting to
true; `false` sends `missing=default`. The default MUST preserve the `null` behavior so that adding
the option changes no existing call.

### Returning rows

By default the server returns nothing. A caller may request the inserted rows back with
`Prefer: return=representation` (feature `database.mutate.select_after_mutation`).

### Composing preferences

`missing=`, `return=`, `count=` and any caller-supplied value are independent entries in one
comma-separated `Prefer` header. Setting one MUST NOT drop another: implementations MUST merge by
replacing only the entry with the matching key, never by replacing the whole header.

## Errors

- `PGRST102` — a bulk payload sent without `columns` whose rows do not all carry an identical key set.
- `PGRST204` — a column named in the payload or in `columns` does not exist on the relation.
- `23502` — a not-null constraint was violated, typically from the default `null` behavior on a
  column with no default.
- `23505` — a unique constraint was violated. Use [`upsert`](upsert.md) to merge or ignore instead.

## Related

- [Upsert Rows](upsert.md) — insert, but resolve a conflict instead of failing
