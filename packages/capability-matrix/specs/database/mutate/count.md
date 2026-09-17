# Count Mutated Rows

Request the number of rows affected by an insert, update, upsert, or delete operation.

## API

Spec: [PostgREST Documentation: Counting](https://docs.postgrest.org/en/latest/references/api/pagination_count.html#counting)

- `POST`, `PATCH`, or `DELETE` with `Prefer: count=exact|planned|estimated`

## Behavior

The caller chooses a supported count strategy when starting a mutation. The response exposes the resulting affected-row count separately from any returned row representation.

Counting is optional. Omitting it avoids requesting a total, and selecting it must not implicitly request the mutated rows themselves.

The count preference is independent of other `Prefer` entries, including `return`, `resolution`, and `missing`. An SDK must preserve those entries when adding the count preference.

## Related

- [Insert Rows](insert.md)
- [Upsert Rows](upsert.md)
- `database.mutate.select_after_mutation`
