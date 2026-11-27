# Check Iceberg Table Exists

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `HEAD /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table}`

## Behavior

The service answers HTTP 204 when the table exists and HTTP 404 when the table
or its namespace does not
([route](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L450-L480),
[lookup](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L460-L489)).
The SDK maps 404 to "does not exist", as in
[Check Iceberg Namespace Exists](namespace_exists.md).

## Related

- [Check Iceberg Namespace Exists](namespace_exists.md): same HEAD semantics
