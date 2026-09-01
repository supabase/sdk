# Insert Rows

Inserts one row or many rows into a table or view via `POST`.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert)

- `POST /{relation}`

## Behavior

Accepts either a single row or a collection of rows. The payload is sent as a JSON object for a
single row and a JSON array for a collection; PostgREST accepts both at the same endpoint.

The rows in a collection do not have to carry the same keys. Where the SDK's row type omits absent
values rather than encoding them as `null` — for example a batch built by mapping over
heterogeneous input — the request MUST name the union of keys across all rows in the `columns`
query parameter. Without it PostgREST derives the column list from the first row alone and silently
drops keys that only later rows carry.

An empty collection is not an error. It sends a request that writes nothing. Implementations MUST
NOT emit an empty `columns` parameter for it, because `columns=""` names a column called `""` and
PostgREST rejects the request.

### Missing columns: `null` versus `DEFAULT`

Once `columns` names the union of keys, a row that omits one of those columns has a decision
attached to it. PostgREST resolves it with the `Prefer: missing` preference:

| `Prefer: missing` | A column named in `columns` but absent from a given row |
| ----------------- | ------------------------------------------------------- |
| absent (default)  | inserted as `null`                                      |
| `missing=default` | takes the column's `DEFAULT` value                      |

Implementations MUST expose this choice as a first-class option on insert. The default MUST
preserve the `null` behavior, so that adding the option changes no existing call. Where an SDK
already names this option, the name is `defaultToNull`, defaulting to true; `false` sends
`missing=default`.

This matters most for a heterogeneous batch: a column with a database default that some rows omit
is overwritten with `null` under the default behavior, which is rarely what the caller means.

### Returning rows

By default the server returns nothing. A caller may request the inserted rows back with
`Prefer: return=representation` (feature `database.mutate.select_after_mutation`).

### Composing preferences

`Prefer` is a comma-separated list of independent preferences. `missing=`, `return=`, `count=`, and
any value the caller set directly are orthogonal, and setting one MUST NOT drop another.
Implementations that build the header by replacement rather than by merging per-key will silently
lose preferences; the merge MUST replace only the entry with the matching key.

## Errors

- `PGRST204` — a column named in the payload or in `columns` does not exist on the relation.
- `23502` — a not-null constraint was violated, which is the typical result of relying on the
  default `null` behavior for a column that has no default.
- `23505` — a unique constraint was violated. Use [`upsert`](upsert.md) to merge or ignore instead.

## Related

- [Upsert Rows](upsert.md) — insert, but resolve a conflict instead of failing
