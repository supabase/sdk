# Resumable Upload

Upload a file in chunks with the [tus 1.0.0 protocol](https://tus.io/protocols/resumable-upload), with pause, resume, cancel, and recovery of an interrupted upload after the process restarts. This is a separate operation from Upload File: it is always tus, it never falls back to a single request, and the caller chooses it; the SDK applies no size threshold.

## API

Spec: [https://tus.io/protocols/resumable-upload](https://tus.io/protocols/resumable-upload) (core, creation, termination, and expiration extensions)

Guide: [https://supabase.com/docs/guides/storage/uploads/resumable-uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)

The storage OpenAPI spec does not describe the tus routes; the Supabase-specific headers and metadata keys below come from the handler: [https://github.com/supabase/storage/blob/master/src/http/routes/tus/lifecycle.ts](https://github.com/supabase/storage/blob/master/src/http/routes/tus/lifecycle.ts).

- `POST /upload/resumable`: creates the upload; the `Location` response header is the upload URL
- `PATCH {upload URL}`: sends one chunk
- `HEAD {upload URL}`: reads the server-confirmed `Upload-Offset`
- `DELETE {upload URL}`: terminates an unfinished upload
- `POST /upload/resumable/sign`: the same, authenticated by a signed upload token in the `x-signature` header instead of a session

The upload URL is absolute. The SDK uses it as returned and does not rebuild it from the project URL, so a server behind a custom public URL or a forwarded prefix keeps working.

The tus server renders an error as a plain-text body holding the message, not the JSON error envelope the other storage routes return, so the SDK maps a failed tus request by HTTP status and surfaces the body text as the message.

## Behavior

**Request headers.** Every request to the endpoint and to the upload URL carries `Tus-Resumable: 1.0.0` and the same `Authorization` and `apikey` headers the SDK sends on a single-request upload. The `POST` carries `Upload-Length` with the exact byte size of the file and `Upload-Metadata` with the following keys, encoded as the tus protocol defines, as comma-separated `key base64(value)` pairs:

- `bucketName` and `objectName`: required; the server derives the object from them, so a `POST` without `Upload-Metadata` is answered with HTTP 400 and the message `Metadata header is required`
- `contentType`: the MIME type the object is stored with; the SDK fills it in the same way it does for a single-request upload
- `cacheControl`: a number of seconds; the server stores it as `max-age={seconds}`, and any other value, or no value, becomes `no-cache`
- `metadata`: a JSON object serialised to a string; it becomes the object's `user_metadata`
- `contentEncoding`: optional, only when the caller sets it

**Upsert.** The upsert option becomes the `x-upsert: true` request header on the `POST` and on every `PATCH`. The server reads the header again on the final `PATCH` when it commits the object, so an upload whose `PATCH` requests omit it is rejected at completion even though its `POST` carried it. Without upsert, a `POST` for a path that already holds a live object is answered with HTTP 409 and the message `The resource already exists`, and so is the final `PATCH` when another writer created the object while this upload ran. The SDK surfaces both as the same error it raises for a single-request upload over an existing object.

**Chunking.** The SDK sends the file as consecutive `PATCH` requests with `Content-Type: application/offset+octet-stream` and `Upload-Offset` set to the server-confirmed offset. On hosted Supabase every chunk except the last is exactly 6 MiB (6 × 1024 × 1024 bytes). The SDK exposes the chunk size as a configuration value with that default, so a self-hosted server configured with a different `TUS_PART_SIZE` can be matched, and never changes it on its own.

<!-- Delete the 6 MiB sentence above once the resumable uploads guide stops requiring a fixed chunk size:
     https://supabase.com/docs/guides/storage/uploads/resumable-uploads -->

The SDK never has two `PATCH` requests in flight for the same upload URL: the server holds a lock per upload and rejects a concurrent writer, and a chunk whose offset does not match is answered with HTTP 409 (see Errors).

**Completion.** The `PATCH` that brings the server's offset to `Upload-Length` is answered with the response header `Tus-Complete: 1`, plus `Supabase-Object-Version-Id` and `Supabase-Object-Id`. A `HEAD` on a finished upload carries the same two `Supabase-*` headers. The SDK treats the upload as finished when that `PATCH` succeeds, and the result exposes the object path, the object id, and the version id.

**Progress.** The upload reports progress as `(bytesUploaded, totalBytes)`. `bytesUploaded` is the server-confirmed offset after each `PATCH`; SDKs that report bytes while a chunk is in flight add them to that base. After a resync (see Errors) the value can go down, and the SDK reports the lower value rather than hiding it.

**Pause and resume.** Pause stops the SDK from sending the next chunk. Whether the in-flight `PATCH` is allowed to finish or is aborted is the SDK's choice; either way the next resume starts with `HEAD` and continues from the returned `Upload-Offset`, never from a local counter. A paused upload keeps its record (below).

**Cancel.** Cancel aborts the in-flight `PATCH`, sends `DELETE` to the upload URL, removes the record, and ends the upload with a cancellation error distinct from a transport failure. The `DELETE` is best-effort: its failure does not change the outcome of cancel.

**Relaunch recovery.** The SDK persists a record of every upload in a store that survives process restarts, keyed by a fingerprint of bucket, object path, and file size. The record holds the upload URL, the bucket, the object path, the file size, the upsert flag, the `Upload-Metadata` values, and the creation time. It is written when the `Location` header arrives, before the first `PATCH`, and removed on completion and on cancel. After a restart the SDK lists the records, and for each one the app reattaches it sends `HEAD` and resumes from the returned `Upload-Offset`, so bytes the server already holds are never sent twice. Neither the record nor a local progress counter is ever trusted over the server's offset.

**Expiry.** The upload URL expires 24 hours after creation on hosted Supabase. A `HEAD` or `PATCH` against an expired or deleted upload URL is answered with HTTP 410 or HTTP 404. The SDK then discards the record, sends a new `POST` with the same metadata and headers, and continues from offset 0, with progress starting again from 0; it does not fail the upload.

**Signed uploads.** When the caller supplies a signed upload token, the SDK posts to `/upload/resumable/sign`, sends the token in the `x-signature` header on every request, and sends no `x-upsert` header: the server takes the upsert flag from the token, which fixes it when the signed URL is created.

**Trade-off.** The SDK may send the first chunk in the `POST` body (the tus creation-with-upload extension) to save a round trip. An SDK that does so still writes the record as soon as the `Location` header is readable, so a crash during that request leaves a record it can `HEAD`.

## Errors

- HTTP 409 on a `PATCH`, when the request's `Upload-Offset` does not match the server's offset: the SDK sends `HEAD`, reads `Upload-Offset`, repositions the source at that offset, and sends the next chunk from there. This resync counts as one retry attempt.
- Transport failure, HTTP 408, HTTP 429, or any HTTP 5xx on a `PATCH` or `HEAD`: the SDK retries after a resync as above. Retries are bounded twice: by a list of delays between consecutive attempts, default `0, 3, 5, 10, 20` seconds, and by a total time budget counted from the first failure of the current chunk, default 120 seconds. Whichever bound is reached first ends the upload with the last error. Both bounds are configurable, and a successful `PATCH` resets both.
- HTTP 413 on the `POST`: `Upload-Length` exceeds the bucket's `file_size_limit` or the project's global limit, whichever is lower. Not retried. The SDK surfaces it as the same error a single-request upload gets for an oversize file.
- HTTP 400 with the message `Invalid Upload-Metadata header` on the `POST`: the SDK produced an `Upload-Metadata` value the server cannot parse. Not retried.
- HTTP 400 on a signed upload whose token is missing (message `Missing x-signature header`), expired, or issued for another path. Not retried.
- HTTP 404 or HTTP 410 on the upload URL: the upload is gone; see Expiry under Behavior. Not counted as a retry.
- A check before the wire: `metadata` is accepted only as a JSON object the SDK serialises itself, never as caller-supplied text, and any other value is rejected as the SDK's own argument error before any request is sent. The server's answer to a `metadata` value it cannot parse as JSON is no error at all: it logs a warning, drops the value, and creates the object without `user_metadata`, so the check is the only thing that keeps the caller's metadata from being lost silently.

<!-- Delete the server sentence above, and keep the check, once supabase/storage rejects an unparsable `metadata` value with HTTP 400 instead of dropping it (handler: src/http/routes/tus/lifecycle.ts, "Failed to parse user metadata"). Upstream issue: not yet opened. -->

## Notes

- SDKs on platforms without a durable local store (a server-side runtime with no file system, a browser with storage disabled) keep the record in memory only. Such an SDK declares `partially_implemented` with a note that recovery after a restart is not available, never `not_applicable`, because pause, resume, and cancel within one process still apply.
- The guide recommends the direct storage hostname (`{project}.storage.supabase.co`) for large uploads. The SDK uses whatever storage URL the client was configured with and does not rewrite it.

## Related

- Upload File (`storage.file_buckets.upload`): the single-request upload; same auth headers, same content type default, same error for an existing path
- Upload with Signed URL (`storage.file_buckets.upload_with_signed_url`): the single-request form of the signed variant
- Upload with Custom Metadata (`storage.file_buckets.upload_with_metadata`): the same `user_metadata`, `cacheControl`, and `contentType` values, sent here through `Upload-Metadata`
- Cancel In-Flight Request (`storage.file_buckets.request_cancellation`): cancel here additionally terminates the server-side upload and removes the record
