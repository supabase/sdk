# Purge File CDN Cache

## API

- `DELETE /cdn/{bucketName}/{objectPath}`

## Behavior

Accepts an object path relative to the bucket root. The SDK prepends the bucket name to form the full path and issues a `DELETE` to `/cdn/{bucketName}/{objectPath}`.

Returns `{ data: { message }, error }`. Server errors are surfaced in `error`; `data` is `null` on failure.

Accepts an optional fetch parameters argument (e.g. an `AbortController` signal) that is forwarded to the underlying request.

## Related

- [Purge Bucket CDN Cache](purge_bucket_cache.md) — invalidate the CDN cache for all objects in a bucket
