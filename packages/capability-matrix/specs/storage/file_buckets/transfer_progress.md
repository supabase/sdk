# Transfer Progress

Report how many bytes an upload or a download has moved so far, and the total when it is known, while the transfer runs.

## Behavior

**Where it applies.** Every operation that sends an object body (upload, update, and upload to a signed URL) and every download accepts an optional progress callback from the caller. Without a callback the SDK counts nothing. Resumable uploads report progress as their own spec defines, because their count follows the server-confirmed offset.

**The report.** Each report carries two values: the bytes moved so far, and the total bytes, which is either a byte count or unknown. The total is the same in every report of one transfer.

- For an upload, the total is the exact byte length of the body when the SDK knows it before it sends the first byte: the length of in-memory bytes, or the size of a file. For a body that is a stream of unknown length, the total is unknown.
- For a download, the total is the `Content-Length` of the 2xx response, which for a ranged download is the length of the range. The total is unknown when the response has no `Content-Length`, as for a transformed image, and when the response has a `Content-Encoding` header and the HTTP stack decodes the body, because `Content-Length` then counts encoded bytes and the caller receives decoded ones.

**What counts as moved.** For an upload, the bytes moved are the bytes the SDK has handed to the HTTP stack for this request. For a download, they are the body bytes delivered to the caller: read from the stream, collected into memory, or written to the file. A download reports nothing before the call has a 2xx response head, and reports nothing for an error body.

**When the callback runs.** The SDK calls the callback after each chunk it moves. It may coalesce reports, but the bytes moved never decrease between two reports of one request, and the callback never runs after an upload has returned its result or raised its error, or after a download's body has ended or failed. The SDK calls it from any thread or task; a caller who updates a user interface moves to the interface thread itself.

**The final report.** When a transfer moves all its bytes, the SDK sends a final report in which the bytes moved equal the total, or, when the total is unknown, equal the bytes actually moved. A zero-byte body gets exactly one report, with both values 0. For an upload the final report comes before the server's answer, so an upload can still fail after a report that says every byte was sent; only the operation's result says the object is stored. For a download the final report comes before the stream ends.

**Resent bodies.** When the SDK sends the body of an upload again, because its retry policy repeats the request or because the server answers with a redirect that repeats it (HTTP 307 or 308), the new request counts from 0, and the SDK sends a report with bytes moved 0 and the same total before the first byte of the new request. The caller sees the count go down instead of a count that passes the total. A download does not repeat once it has returned (see Download File as Stream, `storage.file_buckets.download_as_stream`), so its count never goes down.

## Notes

- An SDK whose HTTP stack cannot observe the bytes of a request body as they are sent, such as a browser `fetch` without request streams, can report download progress only. It declares `partially_implemented` with a note naming the direction it reports, never `not_applicable`.

## Related

- Download File as Stream (`storage.file_buckets.download_as_stream`): the stream whose reads a download counts
- Resumable Upload (`storage.file_buckets.resumable_upload`): its own progress, which follows the server-confirmed offset
- Upload File (`storage.file_buckets.upload`): the single-request upload this reports on
- Automatic Retry (`storage.configuration.auto_retry`): a retried upload restarts its count
