# Insert Rows

Inserts one row or many rows into a table or view via `POST`.

## API

Spec: [https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert](https://docs.postgrest.org/en/latest/references/api/tables_views.html#insert)

- `POST /{relation}`

## Behavior

Accepts either a single row or a collection of rows. The payload is sent as a JSON object for a
single row and a JSON array for a collection; PostgREST accepts both at the same endpoint.

The rows in a collection do not have to carry the same keys, but only because the request says so
explicitly. PostgREST branches on whether `columns` is present:

| `columns` | Payload handling |
| --------- | ---------------- |
| present   | taken as the column list; the payload is passed through without inspection |
| absent    | the first object's key set is canonical, and **every** later object must match it exactly |

With `columns` absent, an object whose keys differ from the first — in either direction, missing or
extra — is rejected outright: `PGRST102`, HTTP 400, "All object keys must match". It is not a partial
write and not a silent truncation.

So where the SDK's row type omits absent values rather than encoding them as `null` — for example a
batch built by mapping over heterogeneous input — the request MUST name the union of keys across all
rows in the `columns` query parameter. That parameter is what makes a ragged batch representable at
all; without it the whole request fails.

An implementation may instead send rows verbatim and let the server reject a ragged batch, which
surfaces `PGRST102` to the caller. That is a legitimate choice, but it is a different contract, and
it MUST be documented as such rather than left for a caller to discover on a batch that happens to
be ragged.

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

- `PGRST102` — HTTP 400, "All object keys must match": a bulk payload sent without `columns` whose
  objects do not all carry an identical key set.
- `PGRST204` — a column named in the payload or in `columns` does not exist on the relation.
- `23502` — a not-null constraint was violated, which is the typical result of relying on the
  default `null` behavior for a column that has no default.
- `23505` — a unique constraint was violated. Use [`upsert`](upsert.md) to merge or ignore instead.

## Related

- [Upsert Rows](upsert.md) — insert, but resolve a conflict instead of failing
