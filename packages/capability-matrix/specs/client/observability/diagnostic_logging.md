# Diagnostic Logging

Supply a logger at construction time to receive the SDK's log emissions. The SDK stays silent unless a logger is provided.

## Behavior

The caller provides a logger through the SDK's construction-time configuration, using the language's standard structured-logging abstraction where one exists (for example `log/slog` in Go, `swift-log` in Swift).

Without a supplied logger the SDK emits nothing, to any destination, and the disabled path must cost effectively nothing per request.
Failures are surfaced through the SDK's error model regardless of logging configuration: a log emission never replaces an error, and enabling logging never changes a call's outcome.

Log emissions describe SDK-internal behavior that is otherwise invisible to the caller - for example request outcomes with timing, retry and backoff decisions, cache refreshes and the lifecycle of background work.
Emissions that merely restate what a call already returned add noise and are discouraged.

Severity follows the host ecosystem's conventions.
Routine per-request emissions belong at debug level.
Severities above debug are reserved for conditions with no other reporting channel, such as a failure inside background work that has no caller to return an error to.

Credentials, tokens, request and response bodies, query strings and header values must never appear in a log emission at any severity.

## Prerequisites

None. Logging is optional construction-time configuration.

## Notes

This capability is the vendor-neutral channel for SDK-originated diagnostics. It complements rather than overlaps `client.observability.trace_propagation`: tracing observes requests from outside the SDK through transport instrumentation, while log emissions carry decisions only the SDK can see.
Ecosystems with OpenTelemetry log bridges (for example Go's `otelslog`) can route these emissions into the same observability pipeline without the SDK taking an OpenTelemetry dependency.

## Related

- `client.observability.trace_propagation` - request-level observability from outside the SDK; diagnostic logging reports the SDK's internal decisions instead
