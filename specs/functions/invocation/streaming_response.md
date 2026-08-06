# Streaming Response (SSE)

Let a caller read a function's response as a stream instead of buffering it fully before returning, when the function opts into server-sent events.

## Behavior

Invocation branches on the response's `Content-Type` header:

- **`text/event-stream`:** the SDK does not buffer or parse the body. It passes through the raw response stream (e.g. the platform's native `Response`/stream type) so the caller can read server-sent events as they arrive, using whatever SSE parsing suits their use case.
- **Any other content type:** normal invocation behavior applies — the SDK buffers and decodes the body as usual (JSON, text, or binary based on content type), matching non-streaming invocations.

This is a passthrough capability: the SDK does not parse SSE frames itself, decide when the stream ends, or retry a dropped stream. Those are the caller's responsibility once handed the raw stream.

## Prerequisites

The invoked function must set `Content-Type: text/event-stream` on its response for streaming behavior to trigger; there is no separate flag on the invocation call itself.

## Notes

- Composes with [Invocation Timeout](functions.invocation.timeout) and [Request Cancellation](functions.invocation.request_cancellation) — cancelling or timing out mid-stream should close the underlying connection the same way it would for a buffered response.
- A function that starts streaming and then errors mid-stream surfaces that as a stream-read error to the caller, not as an invocation-level error, since the SDK has already handed off the raw stream by that point.

## Related

- [Invoke Function](functions.invocation.invoke) — the base call this modifies
- [Invocation Timeout](functions.invocation.timeout)
- [Request Cancellation](functions.invocation.request_cancellation)
