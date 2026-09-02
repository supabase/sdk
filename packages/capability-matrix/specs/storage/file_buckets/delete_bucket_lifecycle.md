# Delete Bucket Lifecycle

Remove the lifecycle policy from a Standard file bucket.

## API

- `DELETE /bucket/{id}/lifecycle`

## Behavior

Deletes the stored policy. The call is idempotent: deleting when no policy is stored still succeeds.

## Prerequisites

Lifecycle support must be enabled on the Storage API. The bucket must be a Standard file bucket.

## Errors

- `FeatureNotEnabled` — lifecycle is off for the project
- Analytics / Iceberg buckets are rejected

## Related

- [Get Bucket Lifecycle](get_bucket_lifecycle.md)
- [Update Bucket Lifecycle](update_bucket_lifecycle.md)
