# Subscribe to Presence Events

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `phx_join` (client to server): `config.presence.enabled` turns presence on for the channel
- `presence_state` and `presence_diff` (server to client): the messages the events report

## Behavior

The app registers listeners for three presence events: `sync`, `join`, and `leave`. A listener for all three is a convenience over the same three events.

### Turning presence on

The SDK sets `config.presence.enabled` in the join payload to `true` when the channel has at least one presence listener at subscribe time, or when the app set the channel's presence `enabled` option to `true`. Otherwise the SDK sends `false`. The server sends `presence_state` and `presence_diff` only to a channel that has presence on, so an app that reads [the presence state](../presence/presence_state.md) without a presence listener sets the option.

The SDK computes the flag at subscribe and sends the same join payload on every rejoin of that subscription.

The flag does not limit [track](../presence/track.md): a channel with presence off can still track, and a successful track turns presence on for it.

### Events

The SDK fires the events as it applies `presence_state` and `presence_diff` by the rules in [Get Presence State](../presence/presence_state.md):

- `join` fires once per key that gains metas in one message. Its payload carries the key, the key's metas before the message (empty for a new key), and the joined metas.
- `leave` fires once per key in the message's leaves that the SDK holds. Its payload carries the key, the key's metas after the removal (empty when the key is gone), and the left metas.
- `sync` fires once after the SDK applies a `presence_state` and the diffs it buffered, and once after each `presence_diff` it applies outside the buffer. `sync` carries no payload: the app reads the presence state.

Within one message, all `join` events fire before any `leave` event, and `sync` fires last. The metas in the payloads have the shape the presence state uses: no `phx_ref` or `phx_ref_prev`, and `presence_ref` set.

Presence state read inside a `join` or `leave` listener is the state before the current message. It reflects the message from that message's `sync` on.

A track that changes the payload of a connection that is already tracked reaches every listener as one message with a `join` of the new meta and a `leave` of the old meta, under the same key.

After a rejoin, the new `presence_state` is diffed against the old state, so `join` and `leave` fire only for presences that changed while the channel was away. The server removes a connection's presence when its channel ends, so this client's own meta from before the rejoin is reported as a `leave`. It comes back as a `join` only when the app tracks again ([Track Presence](../presence/track.md)).

## Errors

- A presence listener added while the channel is joining or joined is rejected with the SDK's own error, and nothing is registered. The join payload already carries `config.presence.enabled`, so a listener added after subscribe on a channel that joined with presence off would never fire. The app adds presence listeners before it subscribes.

## Related

- [Get Presence State](../presence/presence_state.md): the sync rules these events report
- [Track Presence](../presence/track.md): publishes this client's presence
- [Custom Presence Key](../presence/presence_key.md): the key in the event payloads for this client
- Private Channel (RLS) (`realtime.subscriptions.private_channel`): on a private channel, presence events need the `presence.read` policy
