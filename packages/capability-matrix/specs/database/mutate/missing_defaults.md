# Use Defaults for Missing Fields

Use database column defaults instead of null for fields omitted from bulk insert or upsert rows.

## API

Spec: [PostgREST Documentation: Missing](https://docs.postgrest.org/en/latest/references/api/preferences.html#missing)

- `POST /{relation}?columns={union-of-fields}` with `Prefer: missing=default`

## Behavior

When rows in a bulk insert or upsert omit different fields, the caller can choose whether each omitted value becomes SQL `NULL` or uses the column's database `DEFAULT`.

Using database defaults sends `missing=default`. The alternative omits that preference or sends `missing=null`. The choice only affects omitted fields. An explicitly supplied null remains null.

The missing preference is independent of other `Prefer` entries, including `return`, `resolution`, and `count`. An SDK must preserve those entries when changing the missing-field behavior.

## Prerequisites

The request must supply a `columns` parameter containing the union of fields across the rows. Without it, a bulk payload must carry an identical key set on every row (see [Insert Rows](insert.md)), and a field omitted from every row is left out of the statement entirely, so the database applies its default regardless of this preference.

## Related

- [Bulk Write Rows with Differing Fields](bulk_rows_with_differing_fields.md)
- [Insert Rows](insert.md)
- [Upsert Rows](upsert.md)
