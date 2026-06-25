# Purge Bucket CDN Cache

Invalidate the CDN cache for all objects in a bucket. The server issues a CDN invalidation scoped to the entire bucket and returns a success message.

## API

Spec: [https://github.com/supabase/storage/blob/master/src/http/routes/cdn](https://github.com/supabase/storage/blob/master/src/http/routes/cdn)

- `DELETE /cdn/{bucketName}`

## Behavior

Accepts a bucket ID. Sends `DELETE /cdn/{bucketName}` to the Storage API. On success the server returns `{ message: "success" }` and the CDN edge cache for the entire bucket is invalidated. The stored files themselves are not modified or deleted.

## Prerequisites

- The caller must be authenticated with a `service_role` JWT. The endpoint enforces `service_role` — requests made with the anon key or a user JWT are rejected.
- The `purgeCache` tenant feature must be enabled. On self-hosted deployments, `CDN_PURGE_ENDPOINT_URL` must be configured in the Storage service; if not, the server returns an error even with a valid `service_role` key.

## Errors

- Auth error — the JWT is absent, expired, or is not a `service_role` key.
- Feature not enabled — the `purgeCache` tenant feature is off or `CDN_PURGE_ENDPOINT_URL` is not set on the Storage instance.
- Not found — the bucket does not exist.

## Notes

This invalidates the CDN layer only. The bucket and its objects remain intact. The next request to any previously-cached object in the bucket will be served from the origin.

## Related

- [Purge File CDN Cache](purge_cache.md) — invalidate the CDN cache for a single object by exact path
- [URL Cache Invalidation Nonce](url_cache_nonce.md) — client-side alternative: append a nonce to URLs to bypass caching without server-side invalidation
