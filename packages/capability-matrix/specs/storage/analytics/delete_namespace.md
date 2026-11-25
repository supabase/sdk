# Delete Iceberg Namespace

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `DELETE /iceberg/v1/{prefix}/namespaces/{namespace}`

## Behavior

The service answers HTTP 204 with no body
([route](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/namespace.ts#L183-L208)).
A namespace that still holds a table is refused with HTTP 400 and type
`IcebergResourceNotEmpty`, not the Iceberg REST spec's 409
([check](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L674-L705),
[error](https://github.com/supabase/storage/blob/f6deeb7/src/internal/errors/codes.ts#L111-L117)).
A missing namespace answers HTTP 404 with type `NoSuchNamespaceException`.

The route ignores a request body, so the SDK sends none.

## Related

- [Delete Iceberg Table](delete_table.md): empties a namespace
