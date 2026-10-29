# Subscribe

Register the channel with the server and start receiving events.

## API

Spec: [Realtime Protocol](https://supabase.com/docs/guides/realtime/protocol)

## Behavior

This file covers how a channel gets its subscription back after a join fails or the socket reconnects. The caller cannot configure the rejoin delays.

### Rejoin

The client rejoins a channel when its join fails or times out while the socket is open. A join times out when it has no reply within the client's request timeout. The default request timeout is 10 seconds.

Each channel keeps its own rejoin attempt count, starting at 1. The delays are 1, 2, 5, and 10 seconds for attempts 1 to 4, then 10 seconds for every later attempt. The reconnect delays from [Connect](../client/connect.md) never apply to a rejoin.

When the server rejects a join with the error code `ChannelRateLimitReached`, `ConnectionRateLimitReached`, `ClientJoinRateLimitReached`, or `DatabaseConnectionRateLimitReached`, the next rejoin waits 30 seconds instead.

### After a reconnect

When a socket opens, the client resets the rejoin attempt count of every channel to 0, and it rejoins each errored channel at once, without a rejoin delay.

## Related

- [Connect](../client/connect.md): the socket reconnect that triggers an immediate rejoin
- [Heartbeat Interval Configuration](../configuration/heartbeat_interval.md): a missing heartbeat reply marks every joined channel as errored
