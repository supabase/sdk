# Update Iceberg Namespace Properties

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `POST /iceberg/v1/{prefix}/namespaces/{namespace}/properties`

## Notes

The service has no route for this operation
([routes](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/index.ts#L35-L39)),
so the request does not reach a handler and fails. An SDK does not implement
this capability against Supabase Storage until the service serves the route. It
declares it `not_implemented`, with a note that names the missing route.
