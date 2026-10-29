# Configurable Reconnect Backoff

Replace the delay curve the Realtime client uses between attempts to reopen a lost WebSocket connection.

## Behavior

The reconnect backoff is a function from an attempt number to a delay. The caller supplies the function when it constructs the client. [Connect](../client/connect.md) defines when the client reconnects, how it counts attempts, and the default curve. This feature changes only the delay.

A supplied function replaces the default curve completely. The client calls it once for each attempt, with the attempt number from Connect, starting at 1. The SDK does not cap the delays it returns and does not add jitter to them. A negative delay counts as zero, so the client reconnects at once.

## Related

- [Connect](../client/connect.md): reconnect rules and the default curve that this function replaces
- [Heartbeat Interval Configuration](heartbeat_interval.md): a missing heartbeat reply closes the socket and starts a reconnect
