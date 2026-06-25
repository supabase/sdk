# Purge Bucket CDN Cache

## API

- `DELETE /cdn/{bucketName}`

## Behavior

Accepts a bucket ID and issues a `DELETE` to `/cdn/{bucketName}`.

Returns `{ data: { message }, error }`. Server errors are surfaced in `error`; `data` is `null` on failure.

Accepts an optional fetch parameters argument (e.g. an `AbortController` signal) that is forwarded to the underlying request.

## Related

- [Purge File CDN Cache](purge_cache.md) — invalidate the CDN cache for a single object by exact path
