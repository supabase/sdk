# Download File

## API

Spec: [https://supabase.github.io/storage/](https://supabase.github.io/storage/)

- `GET /object/{bucketName}/{wildcard}`: the object

## Behavior

**What the call returns.** The buffered download reads the whole response body into memory and returns it once the body has ended. On a non-2xx status it raises the storage error the streaming download raises, as [Download File as Stream](./download_as_stream.md) defines under non-2xx responses.

**Byte ranges.** An SDK whose buffered download accepts a byte range sends it as the streaming download does, as [Download File as Stream](./download_as_stream.md) defines under byte ranges, and treats HTTP 206 as success. A last offset at or past the end of the object is answered with HTTP 206 and the bytes up to the end, so the SDK returns the 206 body as it is and does not compare its length to the requested range.

**A ranged request answered with HTTP 200.** A ranged request can be answered with HTTP 200 and the whole object, for example when a cache in front of the server ignores the `Range` header. A buffered download that returns the bytes without the response status never returns that body, because a caller who appends it to a partial file cannot tell it from the range. On a 200 to a ranged request it raises its own error and reports no download progress. An SDK whose HTTP stack delivers the response head before the body raises as soon as the head arrives and closes the connection without reading the body; an SDK whose HTTP stack cannot do that discards the body it received. The error is never the storage error type, since the server sent no error, and never the SDK's argument error. It carries the requested range, in the `bytes={first}-{last}` form the SDK sent, and the HTTP status received, and its message names both. A retry policy that applies to downloads does not retry this error, because the cache that ignored the `Range` header answers a repeated request the same way. A buffered download that also returns the response status returns the 200 response as it is, with its status, as the streaming download does.

**Handling a 200 in the caller.** A caller who wants to accept the whole object in place of a range, or decide for itself what to do with it, uses the streaming download, which returns the status and the `Content-Range` header.

## Errors

- A byte range whose first offset is negative, or whose last offset is less than its first, is rejected before any request is sent, as [Download File as Stream](./download_as_stream.md) defines under Errors.
- `InvalidRange`: a first offset at or past the end of the object is answered with HTTP 416 and error code `InvalidRange`. The SDK surfaces it as the storage error with that code, like any other non-2xx answer.

## Related

- [Download File as Stream](./download_as_stream.md): the range format and the error mapping this capability shares, and the download to use when a caller handles a 200 to a ranged request
- [Transfer Progress](./transfer_progress.md): a download rejected for a 200 to a ranged request reports no progress
- Service Error Codes (`storage.errors.error_codes`): the code a non-2xx download raises
