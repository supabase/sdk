# Download File as Stream

## API

Spec: [https://supabase.github.io/storage/](https://supabase.github.io/storage/)

- `GET /object/{bucketName}/{wildcard}`: the object
- `GET /render/image/authenticated/{bucketName}/{wildcard}`: the object with an image transformation applied

## Behavior

**When the call returns.** The streaming download returns as soon as the response head arrives with a 2xx status. It returns the status, the response headers, and the body as a stream the caller reads once. The SDK reads no byte of the body before it returns. The caller can read the stream chunk by chunk, collect it into memory, or write it to a file, as below.

**Non-2xx responses.** The storage routes answer nearly every error with HTTP 400 and put the real status in the `statusCode` string of a JSON body, so the status line alone does not tell a missing object from a bad token. On a non-2xx status the SDK reads the response body, decodes it as the storage error envelope, and raises the storage error the other storage operations raise, with the `code`, `message`, and `statusCode` from the body. It raises that error from the download call itself, before it returns a stream. A body that is not that JSON envelope becomes a storage error that carries the HTTP status and no error code.

**Failures while the body streams.** A failure after the call has returned, such as a dropped connection or a body shorter than its `Content-Length`, surfaces from the read of the stream as the SDK's network error, the same error type a request gets when it cannot connect. It is never a storage error with a server error code, since no error body arrives. The SDK does not retry a download once the call has returned, because the caller may already have read part of the body. A retry policy that applies to downloads acts only before the call returns.

**Collecting into memory.** The SDK offers a way to collect the stream into one in-memory value. It accepts a byte cap from the caller. When the number of bytes received exceeds the cap, the SDK stops reading, closes the connection, discards what it collected, and raises its own error that names the cap. It counts the bytes as the caller receives them, after any decoding the HTTP stack applies, and does not fail on the `Content-Length` header alone. Without a cap the SDK collects the whole body.

**Writing to a file.** The SDK offers a way to write the stream to a file path without holding the whole body in memory. It writes the bytes to a new temporary file in the same directory as the destination and, once the stream ends without error, moves the temporary file over the destination in one atomic rename. On any failure or cancellation it deletes the temporary file and leaves the destination as it was, so the destination never holds a partial body. The destination directory must exist; the SDK does not create it.

**Byte ranges.** An SDK that accepts a byte range sends it as `Range: bytes={first}-{last}`, with both offsets zero-based and inclusive. A satisfied range is answered with HTTP 206 and a `Content-Range` header, and the SDK treats 206 as success like any other 2xx status. The SDK exposes the status and the `Content-Range` header to the caller. A ranged request can also be answered with HTTP 200 and the whole object, for example when a cache in front of the server ignores the header; the SDK returns that response as it is, with its status, and does not trim it to the range, so a caller who resumes a download checks for 206 before appending.

**Cancellation.** When the caller stops reading the stream and releases it, or cancels the task that reads it, the SDK closes the connection.

## Errors

- A byte range whose first offset is negative, or whose last offset is less than its first, is rejected before any request is sent, as the SDK's own argument error and never as the storage error type. The server's answer to such a header depends on the storage backend: the file backend answers HTTP 416 with error code `InvalidRange` and the message `invalid range provided` ([`parseRangeHeader`](https://github.com/supabase/storage/blob/master/src/storage/range.ts)), and an S3 backend passes the header to S3, which ignores a `Range` header it cannot parse and answers with the whole object, so the check is the only way the caller gets the same answer everywhere.
- `InvalidRange`: a first offset at or past the end of the object is answered with HTTP 416 and error code `InvalidRange`, one of the few storage errors whose HTTP status is not 400. The SDK surfaces it as the storage error with that code, from the download call, like any other non-2xx answer.

## Notes

- A platform whose HTTP stack cannot deliver a response body before it has received all of it can still return the body as a stream, but not with flat memory use. An SDK on such a platform declares `partially_implemented` with a note saying so, never `not_applicable`.

## Related

- Download File (`storage.file_buckets.download`): the buffered download, which this capability builds on
- Download with Image Transform (`storage.file_buckets.download_with_transform`): the same modes apply to a transformed image, which the server sends without a `Content-Length`
- Cancel In-Flight Request (`storage.file_buckets.request_cancellation`): cancelling closes the connection while the body streams
- Automatic Retry (`storage.configuration.auto_retry`): retries end when the download call returns
- Service Error Codes (`storage.errors.error_codes`): the code a non-2xx download raises
