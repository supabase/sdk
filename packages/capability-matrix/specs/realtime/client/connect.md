# Connect

Open the WebSocket connection to the Realtime server, and keep it open until the app disconnects.

## API

Spec: [Realtime Protocol](https://supabase.com/docs/guides/realtime/protocol)

## Behavior

This file covers how the client gets a lost connection back. Every SDK reconnects in this way, whether or not it lets the caller configure the delays.

### When the client reconnects

The client schedules a reconnect when the socket closes and the app did not ask for the close. This includes a failed connection attempt, a close the server or the network causes, and a missing heartbeat reply (see [Heartbeat Interval Configuration](../configuration/heartbeat_interval.md)). A close that the app asks for through `realtime.client.disconnect` never schedules a reconnect. It also cancels a reconnect that is waiting.

To reconnect, the client waits the delay for the next attempt number, then opens a new socket to the same endpoint. When that socket fails to open, or closes before it opens, the client schedules the next attempt with the attempt number plus 1.

The client never stops on its own. There is no maximum attempt count. Reconnect attempts continue until a socket opens or the app calls `realtime.client.disconnect`.

The client keeps at most one scheduled reconnect. A new schedule cancels the one that is waiting.

### Attempt count

Attempt numbers start at 1. The attempt count resets to 0 when a socket opens. The open event is the reset point, not a successful channel join. So the first reconnect after a connection that was open is always attempt 1, whatever happened before that connection.

### Delay

The delay for each attempt is full jitter with a 1 second base and a 30 second cap. For attempt `n`, the delay is a uniformly random duration in the closed range from 0 to `min(30 s, 1 s × 2^(n−1))`. Each attempt draws a new random value. From attempt 6 on, the upper bound stays at 30 seconds.

The random spread stops many clients from reconnecting at the same moment after a shared outage.

An SDK that implements [Configurable Reconnect Backoff](../configuration/reconnect_backoff.md) uses the caller's function in place of this curve when the caller supplies one. Everything else in this file stays the same.

### Channels after a reconnect

When a socket opens, the client rejoins each errored channel at once, without a rejoin delay (see [Subscribe](../channel/subscribe.md)).

## Related

- [Heartbeat Interval Configuration](../configuration/heartbeat_interval.md): a missing heartbeat reply closes the socket and starts a reconnect
- [Configurable Reconnect Backoff](../configuration/reconnect_backoff.md): lets the caller replace the delay curve
- [Subscribe](../channel/subscribe.md): how channels rejoin after a failed join or a reconnect
- Disconnect (`realtime.client.disconnect`): the only close that does not reconnect
- Dynamic Access Token Callback (`realtime.configuration.access_token_callback`): supplies the token the reconnected socket uses
