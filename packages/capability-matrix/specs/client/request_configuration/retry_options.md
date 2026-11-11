# Retry Options

Several capabilities send a request to a platform service again after it
failed. Which requests each one covers and which answers it treats as
transient is defined in that capability's spec. What they share is one set of
parameters that describe a retry sequence and one way of running it, which
this spec defines.

The options set on the main Supabase client are the default. Each platform
service client can be given its own, which take precedence for its requests.

## Behavior

A capability runs this sequence only when both hold:

- The first request failed.
- Sending the request again cannot repeat a change on the server, or the
  server tolerates the repeat.

### Parameters

A retry sequence is described by these parameters:

- `baseDelay`: the wait before the first retry. Each later wait doubles the
  one before it: with 200 ms the waits are 200 ms, 400 ms, 800 ms, 1.6 s,
  3.2 s, 6.4 s, 12.8 s, 25.6 s.
- `maxRetries`: the most retries the sequence runs, not counting the first
  request. `0` is no retries.
- `maxDelay`: the upper cap on a wait when doubling `baseDelay`.
- `useJitter`: whether jitter applies. When off, the wait is used as it is.
- `jitterRange`: the range the jitter can fall in, as a factor on the current
  wait. `[0.0, 1.0]` is the full range; `[0.75, 1.25]` is plus or minus 25 %
  of the wait.
- `retryableStatusCodes`: the status codes that count as a transient failure
  worth retrying. A transport failure, in which no response arrives, always
  counts as one.

A capability may bound the sequence by a deadline instead of `maxRetries`: a
time after the first request was sent past which no retry starts. Its spec
says so.

### Default values

SDKs are free to choose their own values for these parameters, but the
following are recommended:

```
baseDelay = 200 ms
maxRetries = 8
maxDelay = 30 s
useJitter = true
jitterRange = [0.0, 1.0]
retryableStatusCodes = [408, 429, 500, 502, 503, 504]
```

A capability whose spec fixes a parameter uses that value whatever the
client's options say.
[Automatic Retry with Backoff](../../database/configuration/auto_retry.md)
fixes the answers it retries, and
[Refresh Session](../../auth/session/refresh_session.md#retryable-failures)
fixes its answers, its `baseDelay`, and its deadline.

### The sequence

1. The SDK sends the first request. When the answer is a transport failure or
   a status in `retryableStatusCodes`, and the bound allows another attempt,
   the SDK waits and sends the request again, unchanged. Otherwise it returns
   the answer as it would have without retries: the response, or the
   transport error.
2. The wait before retry *n*, counting from 1, is `baseDelay` times 2^(n-1),
   capped at `maxDelay`.
3. When `useJitter` is on, the SDK multiplies that wait by a factor drawn at
   random, once per wait, from `jitterRange`, so clients that failed at the
   same moment do not all retry at the same moment. The cap in step 2 and the
   bound in step 4 are judged on the wait before this factor.
4. The bound is judged before each wait starts. Under `maxRetries`, a retry
   runs while fewer retries have run than the limit. Under a deadline, a retry
   runs only when its wait, before jitter, ends within the deadline; the time
   the requests themselves take counts against the deadline, so a slow answer
   leaves room for fewer retries. The SDK never interrupts a request in flight
   on its own: a request still unanswered at the deadline runs to its answer,
   and that answer is the last.

### `Retry-After`

When the answer that triggers a retry carries a `Retry-After` header whose
value is a non-negative number of seconds or an HTTP-date in the future, the
SDK waits the header's value or the jittered backoff wait, whichever is
longer. The bound applies to that wait as to any other: a wait the header
pushes past the deadline, or over `maxDelay`, does not run, and the SDK
returns the answer at once. Any other value, such as a date in the past, is
ignored and the backoff wait applies.

### Cancellation

A cancellation the caller issues, directly or through a deadline the caller
set on the call, ends the sequence at once: the SDK stops retrying, cancels
the request in flight where the platform supports that, and returns the
cancellation as the error. A request the caller cancelled is never sent
again.

### Configuration

The parameters are set at construction time: on the main client for every
platform service client, and on a platform service client for its own
requests. Setting `maxRetries` to `0` turns retries off for that client. A
capability that lets a single request override the client's setting says so
in its spec. The requests a capability covers, and every parameter its spec
fixes, are not configuration.

## Related

- [Automatic Retry with Backoff](../../database/configuration/auto_retry.md): the coverage and parameters for database requests
- Automatic Retry (`storage.configuration.auto_retry`): the coverage and parameters for storage requests
- [Refresh Session](../../auth/session/refresh_session.md#retryable-failures): the coverage and parameters for the refresh request
- [Resumable Upload](../../storage/file_buckets/resumable_upload.md): retries a chunk on its own schedule, not this sequence
- [Diagnostic Logging](../observability/diagnostic_logging.md): each decision to retry or to stop is a debug-level log emission
- Request Cancellation (`database.using_modifiers.request_cancellation`) and Cancel In-Flight Request (`storage.file_buckets.request_cancellation`): the cancellations that end the sequence
- Configurable Reconnect Backoff (`realtime.configuration.reconnect_backoff`): the websocket reconnect schedule, which is not this sequence
