# Automatic Retry with Backoff

Send a read again when the database did not answer it, so a schema cache
reload or a failure at the edge does not reach the caller as an error.

## API

Spec: [PostgREST Documentation: Errors](https://docs.postgrest.org/en/latest/references/errors.html)

There is no dedicated endpoint. The capability sends the covered request
again, unchanged except for the `X-Retry-Count` header below.

## Behavior

The capability covers requests sent with `GET` or `HEAD` and no other method.
A transport failure, in which no response arrives, HTTP 503, and HTTP 520
mean the database did not judge the request: PostgREST answers 503, with a
`Retry-After` header, while it has no usable database connection or is still
loading its schema cache (`PGRST002`), and the edge in front of the project
answers 520 when the origin's response was empty or unreadable. On any of the
three the SDK sends the request again, running the sequence
[Retry Options](../../client/request_configuration/retry_options.md) defines.
Its defaults here are a `baseDelay` of 1 second, a `maxRetries` of 3, 4
requests in all, and a `maxDelay` of 30 seconds, so with every retry the
waits are 1, 2, and 4 seconds before jitter. Every other status is the
database's answer to the request, and the SDK returns it after the first
attempt.

Each retried attempt carries the header `X-Retry-Count` with the retry's
number, counting from 1. The first attempt carries no such header.

Retries are on by default. The caller sets `maxRetries` per client at
construction, and `0` turns retries off. A single request can turn them on or
off regardless of the client's setting. The covered methods and the three
transient answers are fixed and not configuration: any other status is the
database's answer to the request rather than a failure to answer it, and each
retry of such a request holds a database connection for nothing.

## Related

- [Retry Options](../../client/request_configuration/retry_options.md): the sequence, its parameters, `Retry-After`, and cancellation
- [Per-Request Access Token](./access_token.md): the once-per-401 re-send of a renewed token may share this attempt limit
- Request Cancellation (`database.using_modifiers.request_cancellation`): cancelling the request ends the sequence
