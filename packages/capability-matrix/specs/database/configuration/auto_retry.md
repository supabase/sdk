# Automatic Retry with Backoff

Automatically retry idempotent database requests that failed transiently, with capped exponential backoff, switchable per client and overridable per request.

## API

There is no dedicated endpoint. The SDK re-sends the same PostgREST request, adding an `X-Retry-Count: n` header on the n-th retry so a server or proxy can tell a replay from a first attempt.

## Behavior

The rule is fixed and mirrors postgrest-js. A request is retryable when both hold:

- Its method is `GET` or `HEAD`. Nothing else is ever replayed: a write can duplicate its effect, and PostgREST offers no idempotency key.
- The attempt failed transiently: the transport reported a network failure, or the server answered `503` or `520`. Both mean the schema cache or the edge in front of the database is reloading. Every other status, including `500`, is a real answer from the database and is never retried.

The caller cannot widen or narrow the rule. The only knobs are a per-client switch (on by default) and a per-request override of that switch.

Attempts are bounded: 4 in total, including the first.

The wait before the n-th retry is a random duration in `0...min(30s, 1s · 2^(n-1))` ("full jitter", per the AWS Architecture Blog's *Exponential Backoff And Jitter*). Jitter is mandatory: without it every client that lost the same connection retries at the same instant.

When a retryable response carries a `Retry-After` header ([RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), delta-seconds or HTTP-date), the SDK waits that long instead of the jittered backoff, capped at 30 s. A `Retry-After` the SDK cannot parse falls back to the jittered backoff.

Cancellation ends the loop at once: a request cancelled during an attempt or during the wait surfaces the cancellation, never a retry.

Only the network send is retried. A response that decodes badly is never retried. An error thrown by caller-supplied code that runs inside the request (a custom transport or middleware, an access-token callback) propagates untouched and is never retried.

When attempts run out, the last failure (response or transport error) is the request's outcome.

## Prerequisites

None. Retries are on by default.

## Errors

The final error is whatever the last attempt produced; retrying adds no error of its own.

## Notes

- Delays must come from an injectable clock so tests can drive them without sleeping.
- Other targets (Storage, Functions, Auth) reuse the same retry implementation with their own rules; only PostgREST's rule is fixed and not configurable.

## Related

- [Per-Request Access Token](access_token.md) - renewal after a `401` may share this retry limit
- [Automatic Retry](../../storage/configuration/auto_retry.md) - the Storage counterpart, which is configurable
