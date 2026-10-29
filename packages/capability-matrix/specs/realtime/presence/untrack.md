# Untrack Presence

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `presence` (client to server) with `event: "untrack"` and no payload

## Behavior

Untrack sends one `presence` message with `event` set to `untrack` and waits for the server's reply. The call succeeds when the reply's status is `ok`, and fails as defined under Errors.

Untrack removes only this connection's meta. Other connections that track under the same [presence key](presence_key.md) keep theirs, so the key stays in the presence state while any of them is tracked. An untrack on a connection that is not tracked gets an `ok` reply and changes nothing.

Untrack counts against the same per-channel limit as track, and the SDK does not coalesce or skip calls ([Track Presence](track.md)).

Untrack does not change the presence state the SDK holds. The removal arrives in a `presence_diff`, on a channel with presence on, as a `leave` like any other client's.

Unsubscribing from the channel also removes this connection's presence, because the server removes it when the channel ends. An app that is about to unsubscribe does not need to untrack first.

## Prerequisites

The channel is joined.

## Errors

Untrack uses the not-joined, timeout, server-error, and channel-closed errors that [Track Presence](track.md#errors) defines, with these differences on the server side ([handler](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/realtime_channel/presence_handler.ex#L187-L253)):

- The server checks an untrack only against the per-channel client limit. Over that limit, it closes the channel with the `system` message `Client presence rate limit exceeded`, and the SDK fails the call with its channel-closed error.
- The server does not check a payload, the `presence.write` policy, or the per-second project limit for an untrack. So the messages `Track message size exceeded` and `Too many presence messages per second` and the `Presence track payload must be a map` reply never answer an untrack.
- An untrack that passes the limit always gets an `ok` reply. The SDK still fails the call with its server error if a reply has status `error`.

## Related

- [Track Presence](track.md): adds the meta this call removes, and defines the errors
- [Get Presence State](presence_state.md): where the removal shows
