# Get Bucket Lifecycle

Retrieve the lifecycle policy stored on a Standard file bucket.

## API

- `GET /bucket/{id}/lifecycle`

## Behavior

Returns the stored policy document. The document is a `rules` array. Each rule has a status (`Enabled` or `Disabled`), an empty filter, and `noncurrentVersionExpiration` (`noncurrentDays`, optional `newerNoncurrentVersions`).

When no policy is stored, the call fails with `NoSuchLifecycleConfiguration`. Get-bucket does not return the policy.

The policy generation id used internally for optimistic writes is not returned.

## Prerequisites

Lifecycle support must be enabled on the Storage API. The bucket must be a Standard file bucket.

## Errors

- `NoSuchLifecycleConfiguration` — dedicated GET when no policy is stored
- `FeatureNotEnabled` — lifecycle is off for the project
- Analytics / Iceberg buckets are rejected

## Related

- [Update Bucket Lifecycle](update_bucket_lifecycle.md)
- [Delete Bucket Lifecycle](delete_bucket_lifecycle.md)
- [Bucket Versioning Status](bucket_versioning_status.md) — noncurrent-version expiration only does work when versioning has produced previous versions
