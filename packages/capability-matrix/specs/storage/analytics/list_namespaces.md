# List Iceberg Namespaces

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `GET /iceberg/v1/{prefix}/namespaces`

## Behavior

The route accepts `pageToken`, `pageSize`, and `parent`
([schema](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/namespace.ts#L27-L45)),
but the service answers every namespace of the bucket in one response, with no
`next-page-token` and no filter by `parent`
([listing](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L586-L598),
[query](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/pg.ts#L406-L424)).
An SDK that loops on `next-page-token` runs once. An SDK sends the paging
options only when the app sets them, and does not apply a page size of its own.

## Related

- [List Iceberg Tables](list_tables.md): paging differs
