# Expect At Most One Row

## API

Spec: [PostgREST Documentation: Singular or Plural](https://docs.postgrest.org/en/latest/references/api/resource_representation.html#singular-plural)

- `GET` or `HEAD /{relation}`
- `POST`, `PATCH`, or `DELETE /{relation}`
- `GET` or `POST /rpc/{function}`

## Behavior

The query resolves to one of three results:

| Query Match        | Result               |
| ------------------ | -------------------- |
| No rows.           | Success with Nothing |
| Exactly one row.   | Success with Row     |
| More than one row. | Failure with Error   |

Where:

- **Nothing**: the SDK's idiomatic empty value, such as `null`, `nil`, or a zero value
- **Row**: the single row result
- **Error**: a failure indication that the user can handle, as idiomatic for this SDK, of the same type [`single_row`](single_row.md) raises

**Writes.** An insert, upsert, update, or delete on a relation sends `application/vnd.pgrst.object+json` as the `Accept` media type, keeping any parameters the header already carries, such as `nulls=stripped`. The server then checks the count inside the transaction: it rolls back a write that affects more than one row and answers HTTP 406 with `PGRST116`, which the SDK raises as the Error. Counting on the client instead would let the write commit to every matched row before the Error reached the caller. A successful answer with a JSON object as its body resolves to that object as the Row, and one with an empty body, as for a write that does not request `Prefer: return=representation`, resolves to Nothing. A write that affects no row is answered with HTTP 406 and `PGRST116` as well, and the SDK resolves it to Nothing as defined under Errors.

**Reads.** Every other request, which is a `GET` or `HEAD` on a relation or a call to `/rpc/{function}` whatever its method, keeps the `Accept` header it sends without this modifier, so a read that matches no row is answered with HTTP 200 rather than HTTP 406. The SDK takes the row count from the range before the `/` in the `Content-Range` response header, not from the body, because a function that returns a single array value, such as one declared `RETURNS int[]`, answers with a JSON array that the header counts as one row. A range of `*` is 0 rows, and a range of `{first}-{last}` is `last - first + 1` rows. A response without a `Content-Range` header in either form is counted by the elements of its body when the body is a JSON array, and as one row otherwise.

0 rows resolves to Nothing, and more than one row raises the Error defined under Errors. One row resolves to the Row: the single element when the body is a JSON array with exactly one element, and the body itself otherwise. A function that returns a one-element array therefore resolves to that element, since its response cannot be told apart from a set of one row. A `HEAD` response has no body, so it resolves to Nothing for 0 rows or one row, and raises the Error for more than one.

A function call is counted on the client even when the function writes, because the rows a function returns say nothing about the rows it changed.

## Errors

- HTTP 406 with `PGRST116` on a write, whose `details` contains `0 rows` as whole words (the server sends `The result contains 0 rows`): the write affected no row, so the SDK resolves to Nothing instead of raising. Any other HTTP 406 on a write, including a `PGRST116` whose `details` reports more than one row, surfaces as the Error unchanged.
- More than one row on a read: the server answered with success, so the SDK builds the Error itself. It may carry HTTP status 406 and code `PGRST116`, the server's answer to more than one row on a write and on [`single_row`](single_row.md), so that a caller handles both modifiers with one check. It carries no other code.

## Related

- [Expect Single Row](single_row.md): exactly one row, enforced by the server for every method
- Select After Mutation (`database.mutate.select_after_mutation`): returns the written rows that this modifier counts
