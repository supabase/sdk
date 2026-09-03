# Insert Rows

Inserts one row or many rows into a table or view.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert)

- `POST /{relation}`

## Behavior

Accepts a single row (JSON object) or a collection (JSON array).

**Rows with differing keys.** Without a `columns` query parameter, every row must carry an identical
key set; a row that differs is rejected with `PGRST102` and nothing is written. Implementations MUST
either send `columns` naming the union of keys across all rows, or send rows verbatim and document
that all rows must share one key set.

**Empty collection.** Writes nothing, and is not an error. Implementations MUST NOT emit `columns=""`.

**Missing columns.** Where `columns` names a column that a row omits:

| `Prefer: missing` | Value written |
| ----------------- | ------------- |
| absent (default)  | `null` |
| `missing=default` | the column's `DEFAULT` |

Implementations MUST expose this as `defaultToNull`, defaulting to true; `false` sends
`missing=default`.

**Returning rows.** `Prefer: return=representation` returns the inserted rows — feature
`database.mutate.select_after_mutation`.

**Prefer header.** `missing=`, `return=`, `count=` and any caller-supplied value are independent
entries. Implementations MUST merge by replacing only the entry with the matching key, never the
whole header.

## Errors

- `PGRST102` — rows in a bulk payload sent without `columns` do not share one key set
- `PGRST204` — a column named in the payload or in `columns` does not exist
- `23502` — not-null violation
- `23505` — unique violation; use [`upsert`](upsert.md) to merge or ignore instead

## Related

- [Upsert Rows](upsert.md) — insert, but resolve a conflict instead of failing
