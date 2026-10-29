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

The SDK fires the events for each change to the state, as [Get Presence State](../presence/presence_state.md) defines the state's changes and their joined and left entries. A change comes from a `presence_state` with its buffered diffs, from a `presence_diff` applied outside the buffer, or from an unsubscribe. A message the SDK drops because it belongs to another join fires nothing.

- `join` fires once per key that has joined entries in the change. Its payload carries the key, the key's metas before the change (empty for a new key), and the joined metas.
- `leave` fires once per key that has left entries in the change. Its payload carries the key, the key's metas after the change (empty when the key is gone), and the left metas, with the payloads the state held for them.
- `sync` fires once after each change. `sync` carries no payload: the app reads the presence state.

`join` and `leave` never repeat an entry, never report an entry the state did not hold, and never report one entry as both joined and left in one change. Within one change, all `join` events fire before any `leave` event, and `sync` fires last. The metas in the payloads have the shape the presence state uses: no `phx_ref` or `phx_ref_prev`, and `presence_ref` set.

An SDK that exposes the presence state as a stream of values may skip a `sync` for a change that leaves the state unchanged. An SDK that exposes joins and leaves as a stream of changes may skip a change with no joined and no left entries.

An SDK that calls `join` and `leave` listeners while it applies a change returns the state before the change to a read inside such a listener. The state reflects the change from that change's `sync` on.

A track that changes the payload of a connection that is already tracked reaches every listener as one change with a `join` of the new meta and a `leave` of the old meta, under the same key.

After a rejoin, the new `presence_state` is compared with the old state, so `join` and `leave` fire only for presences that changed while the channel was away. The server removes a connection's presence when its channel ends, so this client's own meta from before the rejoin is reported as a `leave`. It comes back as a `join` only when the app tracks again ([Track Presence](../presence/track.md)).

When the app unsubscribes, `leave` fires for every key the state held, with all its metas, then `sync` fires with an empty state. The first `presence_state` of the next subscription fires `join` for every key present on the channel.

## Errors

- A presence listener added while the channel is joining or joined, on a channel that has presence off, is rejected with the SDK's own error, and nothing is registered. The join payload already carries `config.presence.enabled: false`, so such a listener would never fire. A channel has presence on when its join payload carried `true` or a track on it has succeeded since the join. On a channel with presence on, the SDK accepts the listener, which receives the events from the next message on; the app reads the presence state for what came before. The app that wants presence events adds a listener before it subscribes, or sets the presence `enabled` option.

## Related

- [Get Presence State](../presence/presence_state.md): the sync rules these events report
- [Track Presence](../presence/track.md): publishes this client's presence
- [Custom Presence Key](../presence/presence_key.md): the key in the event payloads for this client
- Private Channel (RLS) (`realtime.subscriptions.private_channel`): on a private channel, presence events need the `presence.read` policy
