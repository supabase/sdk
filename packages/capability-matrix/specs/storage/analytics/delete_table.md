# Delete Iceberg Table

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `DELETE /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table}`

## Behavior

The query parameter `purgeRequested` takes `true`, `false`, `True`, or `False`
and defaults to false
([schema](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L192-L215)).
Any other value is refused. The SDK sends `purgeRequested=true` only when the
app asks for a purge, and sends the lowercase form. The service forwards the
flag to the upstream catalog
([handler](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L491-L513),
[drop](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L600-L665)).

The answer is HTTP 204 with no body. A missing table answers HTTP 404 with type
`NoSuchTableException`. The route ignores a request body, so the SDK sends none.
