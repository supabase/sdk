# List Iceberg Tables

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `GET /iceberg/v1/{prefix}/namespaces/{namespace}/tables`

## Behavior

The service reads `pageSize` as a limit on the number of tables, ordered by
creation time, and ignores `pageToken` and `parent`. The response has no
`next-page-token`
([listing](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L337-L366),
[query](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/pg.ts#L75-L101)).
Without `pageSize` it answers every table. An SDK cannot fetch a second page, so
it exposes `pageSize` as a limit and sends it only when the app sets it. A
missing namespace answers HTTP 404 with type `NoSuchNamespaceException`.

## Related

- [List Iceberg Namespaces](list_namespaces.md): no paging at all
