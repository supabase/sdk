# Configurable Reconnect Backoff

Replace the delay curve the Realtime client uses between attempts to reopen a lost WebSocket connection.

## Behavior

The reconnect backoff is a function from an attempt number to a delay. Attempt numbers start at 1. The caller supplies the function when it constructs the client. A supplied function replaces the default curve completely. The SDK does not cap the delays it returns and does not add jitter to them. A negative delay counts as zero, so the client reconnects at once.

### When the client reconnects

The client schedules a reconnect when the socket closes and the app did not ask for the close. This includes a failed connection attempt, a close the server or the network causes, and a missing heartbeat reply (see [Heartbeat Interval Configuration](heartbeat_interval.md)). A close that the app asks for through `realtime.client.disconnect` never schedules a reconnect. It also cancels a reconnect that is waiting.

To reconnect, the client waits the delay for the next attempt number, then opens a new socket to the same endpoint. When that socket fails to open, or closes before it opens, the client schedules the next attempt with the attempt number plus 1.

The client never stops on its own. There is no maximum attempt count. Reconnect attempts continue until a socket opens or the app calls `realtime.client.disconnect`.

The client keeps at most one scheduled reconnect. A new schedule cancels the one that is waiting.

### Attempt count

The attempt count resets to 0 when a socket opens. The open event is the reset point, not a successful channel join. So the first reconnect after a connection that was open is always attempt 1, whatever happened before that connection.

### Default curve

The default curve is full jitter with a 1 second base and a 30 second cap. For attempt `n`, the delay is a uniformly random duration in the closed range from 0 to `min(30 s, 1 s × 2^(n−1))`. Each attempt draws a new random value. From attempt 6 on, the upper bound stays at 30 seconds.

The random spread stops many clients from reconnecting at the same moment after a shared outage.

### Ready-made curves

An SDK may offer ready-made curves next to the custom function. When it does, they follow these rules:

- Full jitter with a caller-supplied base and cap. For attempt `n`, the delay is a uniformly random duration in the closed range from 0 to `min(cap, base × 2^(n−1))`. The default curve is this curve with a base of 1 second and a cap of 30 seconds.
- Steps, from a caller-supplied list of delays. Attempt `n` waits the `n`th delay in the list. Every attempt after the end of the list waits the last delay. An empty list means no wait.

A ready-made curve treats an attempt number below 1 as 1. A negative base, cap, or step counts as zero.

### Channel rejoin

Channel rejoin has its own backoff, and the caller cannot configure it. The reconnect backoff never applies to it. The client uses the rejoin backoff when a channel join fails or times out while the socket is open. A join times out when it has no reply within the client's request timeout (default 10 seconds). The rejoin delays are 1, 2, 5, and 10 seconds for attempts 1 to 4, then 10 seconds for every later attempt. Each channel keeps its own attempt count.

When the server rejects a join with the error code `ChannelRateLimitReached`, `ConnectionRateLimitReached`, `ClientJoinRateLimitReached`, or `DatabaseConnectionRateLimitReached`, the next rejoin waits 30 seconds instead.

When a socket opens, the client resets the rejoin attempt count of every channel to 0, and it rejoins each errored channel at once, without a rejoin delay.

## Related

- [Heartbeat Interval Configuration](heartbeat_interval.md): a missing heartbeat reply closes the socket and starts a reconnect with this backoff
- Connect (`realtime.client.connect`): opens the socket whose loss this backoff governs
- Disconnect (`realtime.client.disconnect`): the only close that does not reconnect
- Dynamic Access Token Callback (`realtime.configuration.access_token_callback`): supplies the token the reconnected socket uses
