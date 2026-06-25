# Purge File CDN Cache

Invalidate the CDN cache for a single object in a bucket. The server issues a CDN invalidation for the named path and returns a success message.

## API

Spec: [https://github.com/supabase/storage/blob/master/src/http/routes/cdn](https://github.com/supabase/storage/blob/master/src/http/routes/cdn)

- `DELETE /cdn/{bucketName}/{objectPath}`

## Behavior

Accepts a bucket name (bound at the client level via the bucket accessor) and an exact object path. Sends `DELETE /cdn/{bucketName}/{objectPath}` to the Storage API. On success the server returns `{ message: "success" }` and the CDN edge cache for that object is invalidated. The stored file itself is not modified or deleted.

The path must be the exact object key relative to the bucket root (e.g. `folder/avatar.png`). There is no wildcard or prefix matching: only the single named object is invalidated.

## Prerequisites

- The caller must be authenticated with a `service_role` JWT. The endpoint enforces `service_role` — requests made with the anon key or a user JWT are rejected.
- The `purgeCache` tenant feature must be enabled. On self-hosted deployments, `CDN_PURGE_ENDPOINT_URL` must be configured in the Storage service; if not, the server returns an error even with a valid `service_role` key.

## Errors

- Auth error — the JWT is absent, expired, or is not a `service_role` key.
- Feature not enabled — the `purgeCache` tenant feature is off or `CDN_PURGE_ENDPOINT_URL` is not set on the Storage instance.
- Not found — the object path does not exist in the bucket (server-dependent behavior; may return 404 or succeed silently).

## Notes

There is no batch or prefix-purge variant for objects. To invalidate multiple objects, call this feature once per path. For bulk invalidation, prefer a server-side solution (e.g. an Edge Function) rather than N sequential client calls.

## Related

- [Purge Bucket CDN Cache](purge_bucket_cache.md) — invalidate the CDN cache for all objects in a bucket
- [URL Cache Invalidation Nonce](url_cache_nonce.md) — client-side alternative: append a nonce to the URL to bypass CDN caching without a server-side invalidation
