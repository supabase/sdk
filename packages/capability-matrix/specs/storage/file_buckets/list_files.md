# List Files

## API

Spec: [https://supabase.github.io/storage/](https://supabase.github.io/storage/)

- `POST /object/list-v2/{bucketName}`: one page of a cursor-paged listing
- `POST /object/list/{bucketName}`: the legacy offset-paged listing

The API spec documents no success body for `POST /object/list-v2/{bucketName}`. The handler, [`listObjectsV2`](https://github.com/supabase/storage/blob/master/src/storage/object.ts), answers with `hasNext`, `nextCursor`, `folders`, and `objects`.

<!-- Delete the paragraph above once the list-v2 route in supabase/storage declares its 200
     response schema: https://github.com/supabase/storage/blob/master/src/http/routes/object/listObjectsV2.ts -->

## Behavior

**One page per request.** The SDK exposes a call that fetches one list-v2 page. It takes the listing options and an optional cursor, and returns the page's objects, its folders, and the cursor for the next page. Without a cursor it fetches the first page.

**The cursor travels with the first page's options.** The cursor is opaque: the SDK never decodes, builds, or edits it. The server reads `prefix`, `with_delimiter`, and `limit` from the request body on every page, not from the cursor, so a request that carries a cursor and omits the prefix lists from the bucket root. The SDK therefore sends every page with the same body as the first page, with `cursor` added. A caller that pages by hand passes the same options with each cursor; an SDK that keeps the options for the caller, such as in an iterator, attaches them itself.

**The end of the listing.** The listing ends after the page whose `hasNext` is `false`. The SDK decides the end from `hasNext` alone. It never ends a listing because a page holds fewer entries than `limit`, or none: folders count toward `limit`, so a page can hold fewer objects than requested and still have a next page. On the last page the server sends no `nextCursor`, and the SDK exposes no next cursor.

**Iteration.** An SDK may also offer iteration over every page or every object of a listing. When it does, it sends a request only when the caller asks for the next page or the next object after the current page is used up, and it sends no request when the caller stops iterating. The first failed request ends the iteration with that error. The iteration does not resume after the error; the caller resumes by fetching one page with the last cursor it received.

**Prefix.** The prefix is the start of the object keys to list, not a folder: `2026` also selects `2026-old/a.png`. The SDK sends the prefix without appending or removing a trailing `/`, because `photos` and `photos/` select different keys.

**Folders.** The SDK sends `with_delimiter` only when the caller sets it. Without it the server lists every key at every depth and returns no folders. With `with_delimiter: true` the server collapses the keys below the next `/` after the prefix into one folder entry, whose name is the full prefix ending in `/`. The SDK exposes folders separately from objects, as those full names. It does not return a folder as an object: a folder entry has a `null` id and no metadata, and its timestamps are those of one of the objects below it.

**Names.** Object names and folder names in a list-v2 page are full keys. The SDK returns them as the server sends them and does not strip the prefix.

**Page size.** The SDK sends `limit` only when the caller sets it. The server default and maximum are both 1000, and the server lowers a larger `limit` to 1000 without an error, so a page never holds more than 1000 entries.

**The legacy listing.** `POST /object/list/{bucketName}` is a separate operation with different results: offset paging, a `search` filter, one level only, names relative to the prefix, and folders returned as rows whose `id` is `null`. The server appends `/` to a non-empty prefix that lacks one, unless `exactMatch` is `true`. For this call the SDK sends `prefix` as the empty string when the caller gives none, because the server requires the field, and it fills in `limit: 100`, `offset: 0`, and `sortBy: { column: "name", order: "asc" }` for each of them the caller does not set; a caller who sets only `sortBy.column` keeps the default `order`. The SDK never switches between the two endpoints on its own, because the names and the paging of their results differ.

## Errors

- `FeatureNotEnabled`: a project whose storage schema predates list-v2 answers `POST /object/list-v2/{bucketName}` with HTTP 400, error code `FeatureNotEnabled`, and the message `This feature is not available for your tenant`. The SDK surfaces it as a storage error with that code and does not fall back to the legacy listing.
- `InvalidParameter`: a request whose version filters or `exactMatch` differ from the values locked in its cursor is answered with HTTP 400, error code `InvalidParameter`, and a message of the form `{name} must match the value used to obtain this continuation token (expected "{value}")`. Sending the first page's body with every cursor, as above, never causes it.

## Related

- List File Versions and Delete Markers (`storage.file_buckets.list_file_versions`): the `noncurrentVersions` and `deleteMarkers` filters, which the cursor locks
- Cancel In-Flight Request (`storage.file_buckets.request_cancellation`): cancelling a page request ends an iteration the same way an error does
