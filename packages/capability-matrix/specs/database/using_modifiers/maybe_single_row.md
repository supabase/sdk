# Expect At Most One Row

## API

Spec: [PostgREST Documentation: Singular or Plural](https://docs.postgrest.org/en/latest/references/api/resource_representation.html#singular-plural)

- `GET` or `HEAD /{relation}`
- `POST`, `PATCH`, or `DELETE /{relation}` with `Prefer: return=representation`
- `GET` or `POST /rpc/{function}`

## Behavior

The query resolves to one of three results: Nothing when no row matches, the Row when exactly one row matches, and an Error when more than one row matches. Nothing is the SDK's idiomatic empty value, such as `null`, `nil`, or a zero value. The Error is a failure indication that the user can handle, as idiomatic for this SDK, of the same type [`single_row`](single_row.md) raises.

**Reads.** A `GET` or `HEAD` request on a relation, and every call to `/rpc/{function}` whatever its method, keeps the `Accept` header it sends without this modifier. The SDK counts the elements of the JSON array in the response body: an empty array resolves to Nothing, one element resolves to that element as the Row, and more than one raises the Error defined under Errors. The single-object `Accept` header would make the server answer a read that matches no row with HTTP 406, so the SDK keeps the default header and a lookup that finds nothing is not recorded as a failed request. A function call is counted on the client even when it writes, because the rows a function returns say nothing about the rows it changed.

**Writes.** An insert, upsert, update, or delete on a relation sends `Accept: application/vnd.pgrst.object+json`, so the count is checked inside the transaction. The server rolls back a write that affects more than one row and answers HTTP 406 with `PGRST116`, which the SDK raises as the Error, and nothing is written. Counting on the client instead would let the write commit to every matched row before the Error reached the caller. A successful answer carries one JSON object, which the SDK returns as the Row. A write that affects no row is answered with HTTP 406 and `PGRST116` as well, and the SDK resolves it to Nothing as defined under Errors.

## Errors

- HTTP 406 with `PGRST116` on a write, whose `details` contains `0 rows` as whole words (the server sends `The result contains 0 rows`): the write affected no row, so the SDK resolves to Nothing instead of raising. Any other HTTP 406 on a write, including a `PGRST116` whose `details` reports more than one row, surfaces as the Error unchanged.
- More than one row on a read: the server answered with success, so the SDK builds the Error itself. It may carry HTTP status 406 and code `PGRST116`, the server's answer to more than one row on a write and on [`single_row`](single_row.md), so that a caller handles both modifiers with one check. It carries no other code.

## Related

- [Expect Single Row](single_row.md): exactly one row, enforced by the server for every method
- Select After Mutation (`database.mutate.select_after_mutation`): returns the written rows that this modifier counts
