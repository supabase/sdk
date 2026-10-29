# Get Presence State

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `presence_state` (server to client): the full set of presences on the channel
- `presence_diff` (server to client): the `joins` and `leaves` since the previous message

Reading the presence state sends nothing. It returns the state the SDK builds from these two messages.

## Behavior

The SDK keeps one presence state per channel. The state is a map from presence key to a list of metas. A key holds one meta per connection that tracks under that key, so one user with two devices, or two tabs, has two metas under one key.

The app reads each meta as the payload that connection passed to [track](track.md), plus the meta's `phx_ref` value under the name `presence_ref`. The SDK removes the `phx_ref` and `phx_ref_prev` keys from the meta: they belong to the sync protocol, not to the app's payload.

Reading the state returns a snapshot. A later `presence_state` or `presence_diff` does not change a value the app already holds.

The SDK updates the state by the Phoenix Presence client sync rules ([`presence.js`](https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/js/phoenix/presence.js)):

1. A `presence_state` message replaces the set. The SDK diffs it against the state it holds. Under each key, a meta whose `phx_ref` is in the message and not in the held state is a join, and a meta whose `phx_ref` is in the held state and not in the message is a leave. A held key that is absent from the message leaves with all its metas. The SDK applies those joins and leaves by rule 2, and the result equals the set in the message.
2. A `presence_diff` message merges by key and `phx_ref`. For each key in `joins`, the key's metas become its held metas whose `phx_ref` is not among the joined metas, followed by the joined metas, in that order. For each key in `leaves`, the SDK removes the held metas whose `phx_ref` is among the left metas, and removes the key when it has no metas left. A leave for a key the SDK does not hold changes nothing. Within one message, the SDK applies all joins before any leave.
3. A `presence_diff` that arrives before the first `presence_state` of the current join waits. When a `presence_state` arrives, the SDK records the channel's join ref. A diff that arrives while no join ref is recorded, or while the recorded ref differs from the channel's current join ref, goes to a buffer. Right after the SDK applies the next `presence_state`, it applies the buffered diffs in the order they arrived, then empties the buffer.
4. On a rejoin, after a socket reconnect or a channel error, the SDK keeps the old state and returns it until the new join's `presence_state` arrives. The SDK diffs that message against the old state by rule 1, so only the presences that joined or left while the channel was away are reported as joins and leaves ([Subscribe to Presence Events](../subscriptions/subscribe_presence.md)).

The SDK applies every `presence_state` it receives, not only the first one after a join. The server sends a second `presence_state` when a track turns presence on for a channel that joined with presence off ([handler](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/realtime_channel/presence_handler.ex#L294-L308)).

## Notes

- The state stays empty on a channel that has presence off, because the server sends that channel no `presence_state` and no `presence_diff`. [Subscribe to Presence Events](../subscriptions/subscribe_presence.md) defines when the SDK turns presence on.
- On a private channel, the server sends presence messages only to a client that its `presence.read` policy authorizes ([Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)), so the state stays empty for any other client.

## Related

- [Subscribe to Presence Events](../subscriptions/subscribe_presence.md): the events the SDK fires as it applies these rules
- [Track Presence](track.md): adds or replaces this connection's meta
- [Custom Presence Key](presence_key.md): the key this connection's meta goes under
