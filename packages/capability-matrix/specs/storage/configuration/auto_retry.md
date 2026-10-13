# Automatic Retry

Automatically retry a storage request that failed transiently, with control over how many attempts are made before the error surfaces to the caller.

## API

There is no dedicated endpoint. The SDK re-sends the same Storage API request, adding an `X-Retry-Count: n` header on the n-th retry.

## Behavior

A request is retryable when both hold:

- Its method is safe to replay: `GET`, `HEAD`, `OPTIONS`, `PUT` or `DELETE`. A request that carries an `Idempotency-Key` header is retryable whatever its method. A `POST` without that header is never retried, since replaying it can duplicate a write.
- The attempt failed transiently: the transport reported a network failure, or the server answered with one of `408`, `429`, `500`, `502`, `503`, `504`, or Cloudflare's `520`–`524` and `530`.

Uploads deserve one extra rule. An upload body is replayed only when it can be read again from the start (an in-memory buffer or a file on disk). A body streamed from a one-shot source is never retried, and the first failure is the request's outcome.

Attempts are bounded. The default is 3 attempts in total, including the first. The caller configures the count per client; setting it to 1 disables retries. The caller may also tune the delays and the retryable statuses and methods.

The wait before the n-th retry is a random duration in `0...min(maxDelay, baseDelay · 2^(n-1))` ("full jitter"). Defaults are a 500 ms base and a 20 s cap. When a retryable response carries a `Retry-After` header ([RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), delta-seconds or HTTP-date), the SDK waits that long instead, capped at `maxDelay`.

Cancellation ends the loop at once. Only the network send is retried; an error thrown by caller-supplied code that runs inside the request propagates untouched. When attempts run out, the last failure is the request's outcome.

## Prerequisites

None. Retries are on by default.

## Errors

The final error is whatever the last attempt produced; retrying adds no error of its own.

## Related

- [Automatic Retry with Backoff](../../database/configuration/auto_retry.md) - the PostgREST counterpart, whose rule is fixed
