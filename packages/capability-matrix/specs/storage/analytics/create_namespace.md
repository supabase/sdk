# Create Iceberg Namespace

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `POST /iceberg/v1/{prefix}/namespaces`

The request body differs from the Iceberg REST spec: `namespace` is a single
string, not an array of strings
([schema](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/namespace.ts#L7-L25)).
The service wraps it in a one-element array
([handler](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/namespace.ts#L92-L113)),
so the namespace has one level and the response `namespace` is a one-element
array.

## Behavior

- Creating a namespace that exists answers HTTP 200, not 409. The service
  inserts the namespace or merges the given `properties` into the stored ones
  ([upsert](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/pg.ts#L385-L396)).
  An SDK cannot rely on an error to tell "created" from "already there", and
  calls [Check Iceberg Namespace Exists](namespace_exists.md) first when the app
  needs that distinction.
- The `properties` values are strings.
- A namespace past the project's limit answers HTTP 409 with type
  `IcebergMaximumResourceLimit`
  ([error](https://github.com/supabase/storage/blob/f6deeb7/src/internal/errors/codes.ts#L104-L110)).

## Notes

Whether an array `namespace` is accepted is unverified: the schema declares a
string, and the service's validator may coerce a one-element array. An SDK sends
a string.

## Related

- [Check Iceberg Namespace Exists](namespace_exists.md): tells created from
  existing
