# Access Iceberg Catalog

## API

Spec:
[https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)

- `GET /iceberg/v1/config?warehouse={bucket}`
- `{prefix}` paths: `/iceberg/v1/{prefix}/namespaces/...`

The service serves a subset of the Iceberg REST API, mounted under `/iceberg` of
the Storage API
([routes](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/index.ts#L16-L54)).
The other capabilities in this group name the operations it serves.

## Behavior

- **Prefix.** The `{prefix}` path segment is the analytics bucket name.
  `GET /iceberg/v1/config` answers `overrides.prefix` and `defaults.prefix` with
  the bucket name
  ([`getConfig`](https://github.com/supabase/storage/blob/f6deeb7/src/storage/protocols/iceberg/catalog/tenant-catalog.ts#L114-L133)),
  so an SDK uses the bucket name as the prefix and does not need to call
  `config` first. For a bucket that does not exist the call answers HTTP 404
  with type `NoSuchCatalog`
  ([error](https://github.com/supabase/storage/blob/f6deeb7/src/internal/errors/codes.ts#L631-L637)).
- **Credentials.** Every route accepts only a JWT whose role is the service
  role, so the client has to hold the service role key. The routes exist only
  when the project has Iceberg enabled
  ([gate](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/index.ts#L19-L34)).
- **Errors.** Every error body is
  `{"error": {"message": string, "type": string, "code": number}}`, where `code`
  is the HTTP status as a number and `type` is the error type, such as
  `NoSuchTableException` or `AlreadyExistsException`
  ([handler](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/index.ts#L41-L52)).
  An SDK that reads the Storage error shape `{statusCode, error, message}` finds
  none of those fields.
- **64-bit integers.** Table responses carry 64-bit integers, such as snapshot
  IDs, as JSON integers that can exceed 2^53
  ([serializer](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/table.ts#L344-L353)).
  An SDK in a language whose JSON decoder reads numbers as doubles decodes them
  as 64-bit integers or keeps the raw digits, so a snapshot ID round-trips
  unchanged.

## Notes

The service does not serve every Iceberg REST operation. It has no route to
update namespace properties, rename a table, or register a table
([routes](https://github.com/supabase/storage/blob/f6deeb7/src/http/routes/iceberg/index.ts#L35-L39)),
so the matrix has no capability for them.
