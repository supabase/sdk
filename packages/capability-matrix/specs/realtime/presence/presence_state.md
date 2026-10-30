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

An entry is one meta, identified by its key and its `phx_ref`. The SDK updates the state by these rules, which follow the Phoenix Presence client sync ([`presence.js`](https://github.com/phoenixframework/phoenix/blob/d344ec0a732ab4ee204215b31de69cf4be72e3bf/assets/js/phoenix/presence.js)):

1. A message from another join is dropped. A `presence_state` or `presence_diff` whose `join_ref` is set and differs from the channel's current join ref changes nothing and is not reported, for example a late reply to an abandoned join attempt. A message without a `join_ref`, such as a `presence_diff` the server broadcasts, applies by the rules below.
2. A `presence_state` message replaces the set: the state becomes the set in the message.
3. A `presence_diff` message merges by key and `phx_ref`. For each key in `joins`, a joined meta replaces the held meta with the same `phx_ref`, and a joined meta with a new `phx_ref` goes after the key's held metas. For each key in `leaves`, the SDK removes the held metas whose `phx_ref` is among the left metas, and removes the key when it has no metas left. A left meta that the state does not hold changes nothing. Within one message, the SDK applies all joins before any leave.
4. A `presence_diff` that arrives before the first `presence_state` of the current join waits in a buffer. Right after the SDK applies that `presence_state`, it applies the buffered diffs in the order they arrived, then empties the buffer.
5. On a rejoin, after a socket reconnect, a channel error, or a close the app did not ask for, the SDK keeps the old state and returns it until the new join's first `presence_state` arrives.
6. Unsubscribe ends the presence state. When the app unsubscribes from the channel, the SDK clears the state. The next subscription starts from an empty state.

The SDK reports each change to the state as the exact difference by entry, so the joins and leaves an app has applied, in order, always add up to the state:

- For a `presence_state`, the change is the difference between the state before the message and the state after the message and its buffered diffs are applied. A joined entry is one the state after holds and the state before does not, and a left entry is the reverse. A buffered diff that overlaps the `presence_state`, such as a join of an entry the message already holds or a leave of one it lacks, is not reported a second time, and no entry is reported as both joined and left in one change. After a rejoin, only the presences that joined or left while the channel was away are reported, and the first `presence_state` of a new subscription reports every present entry as joined.
- For a `presence_diff` applied outside the buffer, a joined entry is a joined meta whose entry the state did not hold, and a left entry is a held entry whose `phx_ref` is among the left metas. A join of an entry the state already holds and a leave of an entry it does not hold are not reported.
- For an unsubscribe, every entry the state held is left.

A left entry carries the payload the state held for it, not the left meta from the server, which can hold only `phx_ref`. [Subscribe to Presence Events](../subscriptions/subscribe_presence.md) defines the events that report each change.

The SDK applies every `presence_state` it receives from the current join, not only the first one. The server sends a second `presence_state` when a track turns presence on for a channel that joined with presence off ([handler](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/realtime_channel/presence_handler.ex#L294-L308)).

## Notes

- The state stays empty on a channel that has presence off, because the server sends that channel no `presence_state` and no `presence_diff`. [Subscribe to Presence Events](../subscriptions/subscribe_presence.md) defines when the SDK turns presence on.
- On a private channel, the server sends presence messages only to a client that its `presence.read` policy authorizes ([Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)), so the state stays empty for any other client.

## Related

- [Subscribe to Presence Events](../subscriptions/subscribe_presence.md): the events the SDK fires as it applies these rules
- [Track Presence](track.md): adds or replaces this connection's meta
- [Custom Presence Key](presence_key.md): the key this connection's meta goes under
