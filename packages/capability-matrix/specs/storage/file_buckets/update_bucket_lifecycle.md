# Update Bucket Lifecycle

Replace the lifecycle policy on a Standard file bucket. The body is the full policy. Anything previously stored is overwritten.

## API

- `PUT /bucket/{id}/lifecycle`

Create-bucket and update-bucket reject a `lifecycle_configuration` field. The policy is only written through this dedicated replace.

## Behavior

The body is `{ rules: [...] }` with 1 to 1000 rules. An empty `rules` array is rejected. To clear the policy, delete it.

Each rule:

- `status` is `Enabled` or `Disabled`
- `filter` must be the empty object. Prefix, tag, and object-size filters are rejected
- the only accepted action is `noncurrentVersionExpiration`, with `noncurrentDays` (minimum 1) and optional `newerNoncurrentVersions` (1 to 100)
- `id` is optional, unique when set, max 255 characters. The server generates an id when it is omitted
- current-object expiration, transitions, and abort-incomplete-multipart are rejected

The response is the stored policy, including any generated rule ids.

## Prerequisites

Lifecycle support must be enabled on the Storage API, and the tenant schema must include the lifecycle migration. The bucket must be a Standard file bucket. Noncurrent-version expiration only expires previous versions, so versioning needs to have been enabled for the policy to have anything to act on.

## Errors

- `FeatureNotEnabled` — lifecycle is off, or the tenant schema is not ready
- `InvalidParameter` — empty rules, duplicate ids, unsupported fields, or a non-empty filter
- Analytics / Iceberg buckets are rejected

## Related

- [Get Bucket Lifecycle](get_bucket_lifecycle.md)
- [Delete Bucket Lifecycle](delete_bucket_lifecycle.md)
- [Bucket Versioning Status](bucket_versioning_status.md)
