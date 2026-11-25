# Update Iceberg Table

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `POST /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table}`

## Behavior

The body is the Iceberg REST commit request. The service requires both
`requirements` and `updates` arrays and an `action` in every update, and a
`type` in every requirement
([schema](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L217-L318)).
The SDK always sends `requirements`, as an empty array when the app gives none.

The service parses this request body with a 64-bit integer parser
([parser](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L516-L538)),
so a snapshot ID above 2^53 in `updates` or `requirements` reaches the catalog
unchanged. The SDK serializes 64-bit integers as integers and never through a
double.

A missing table answers HTTP 404 with type `NoSuchTableException`. The response
is the new table metadata
([handler](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L540-L572)).
