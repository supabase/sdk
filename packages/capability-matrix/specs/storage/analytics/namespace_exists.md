# Check Iceberg Namespace Exists

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `HEAD /iceberg/v1/{prefix}/namespaces/{namespace}`

## Behavior

`{namespace}` is the plain namespace name, since namespaces have one level
([route](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/namespace.ts#L139-L159)).
The service answers HTTP 204 when the namespace exists and HTTP 404 when it does
not
([lookup](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L500-L511)).
A HEAD answer has no body, so the SDK maps 404 to "does not exist" and does not
read an error type. A 404 also answers a missing bucket, so the SDK cannot tell
a missing namespace from a missing bucket with this call.

[Check Iceberg Table Exists](table_exists.md) follows the same rules.

## Related

- [Check Iceberg Table Exists](table_exists.md): same HEAD semantics
