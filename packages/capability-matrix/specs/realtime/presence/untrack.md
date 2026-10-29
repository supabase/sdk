# Untrack Presence

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `presence` (client to server) with `event: "untrack"` and no payload

## Behavior

Untrack sends one `presence` message with `event` set to `untrack` and waits for the server's reply. The call succeeds when the reply's status is `ok`, and fails in the same cases and with the same errors as [Track Presence](track.md#errors).

Untrack removes only this connection's meta. Other connections that track under the same [presence key](presence_key.md) keep theirs, so the key stays in the presence state while any of them is tracked. An untrack on a connection that is not tracked gets an `ok` reply and changes nothing.

Untrack counts against the same per-channel limit as track, and the SDK does not coalesce or skip calls ([Track Presence](track.md)).

Untrack does not change the presence state the SDK holds. The removal arrives in a `presence_diff`, on a channel with presence on, as a `leave` like any other client's.

Unsubscribing from the channel also removes this connection's presence, because the server removes it when the channel ends. An app that is about to unsubscribe does not need to untrack first.

## Prerequisites

The channel is joined.

## Related

- [Track Presence](track.md): adds the meta this call removes, and defines the errors
- [Get Presence State](presence_state.md): where the removal shows
