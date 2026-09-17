# Bulk Write Rows with Differing Fields

Insert or upsert multiple rows with different field sets in one request.

## API

Spec: [PostgREST Documentation: Specifying Columns](https://docs.postgrest.org/en/latest/references/api/tables_views.html#specifying-columns)

- `POST /{relation}?columns={union-of-fields}`

## Behavior

The SDK accepts a collection whose rows do not all contain the same fields and sends it as one bulk insert or upsert. It identifies the union of fields across the non-empty collection and supplies that set through PostgREST's `columns` query parameter.

The SDK must not require callers to add placeholder values for omitted fields. Their values follow the missing-field behavior selected for the request.

An empty collection writes nothing and must not produce an empty `columns` parameter.

## Errors

- `PGRST204` when a field named by `columns` does not exist
- Database constraint errors still apply to every row in the bulk operation

## Related

- [Insert Rows](insert.md)
- [Upsert Rows](upsert.md)
- [Use Defaults for Missing Fields](missing_defaults.md)
