# Create Iceberg Table

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `POST /iceberg/v1/{prefix}/namespaces/{namespace}/tables`

The request body is the Iceberg REST `CreateTableRequest` with one difference in
the declared schema: the partition spec key is `spec`, not `partition-spec`
([schema](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L9-L155)).
The service requires `name` and `schema`. It forwards the rest of the body
unchanged to the upstream catalog
([handler](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L355-L382),
[forward](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/rest-catalog-client.ts#L844-L856)),
so the key the upstream catalog honors decides the partitioning. Whether the
upstream honors `partition-spec` is unverified, so an SDK sends the partition
spec as `spec`.

## Behavior

- The SDK sends `location`, `write-order`, `properties`, and `stage-create` only
  when the app sets them. The service defaults `stage-create` to false.
- A table name or namespace that is not lowercase letters, digits, and
  underscores is refused with an invalid-parameter error
  ([rules](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L737-L780)).
  The SDK does not check names.
- A missing namespace answers HTTP 404 with type `NoSuchNamespaceException`. An
  existing table answers HTTP 409 with type `AlreadyExistsException`. A table
  past the project's limit answers HTTP 409 with type
  `IcebergMaximumResourceLimit`.
- The response has the table metadata with 64-bit integers as in
  [Access Iceberg Catalog](access_catalog.md).
