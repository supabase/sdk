# Request Timeout

Bound how long a database request may wait on the network. A request that exceeds the bound fails with a timeout error instead of hanging, and the underlying connection is released.

## Behavior

The caller sets a timeout at client construction time. It applies to every request the client sends, including the requests an automatic retry re-sends.

Where the SDK offers a per-request override, the per-request value wins over the construction-time value for that one request. Neither value changes any other request or any other client.

The timeout is expressed in the platform's idiomatic duration unit (milliseconds in JavaScript, seconds in Swift). The SDK documents the unit and any default it applies when the caller sets nothing. An SDK may leave requests unbounded when nothing is set, or apply a platform default; it must not invent a default silently.

The bound may be a total deadline for the whole exchange or an idle timeout that fires once no bytes have moved for the given interval. Both satisfy this capability; the SDK documents which one it implements. Either way, when the bound fires the SDK:

- cancels the in-flight request so the connection is released;
- surfaces a timeout error that the caller can tell apart from a server error and from a caller-initiated cancellation, where the platform makes that distinction possible.

A non-positive value is treated as unset. It must never mean "fail immediately".

### Interaction with retries

The timeout bounds each attempt, not the sum of all attempts. A timeout on an idempotent request counts as a transient network failure and is eligible for `database.configuration.auto_retry`.

### Interaction with cancellation

A caller-initiated cancellation (`database.using_modifiers.request_cancellation`) composes with the timeout: whichever fires first ends the request. Neither disables the other.

## Errors

The timeout surfaces as the platform's network-layer timeout error (for example an `AbortError` in JavaScript, `URLError.timedOut` in Swift), never as a PostgREST error decoded from a response body.

## Related

- `database.using_modifiers.request_cancellation` — caller-initiated cancellation; composes with the timeout
- `database.configuration.auto_retry` — a timed-out attempt on an idempotent request is retried like any other transient failure
- `functions.invocation.timeout` — the same knob for Edge Function invocations
