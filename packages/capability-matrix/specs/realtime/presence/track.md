# Track Presence

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `presence` (client to server) with `event: "track"` and the app's payload

## Behavior

Track sends one `presence` message with `event` set to `track` and the app's payload, then waits for the server's reply. The payload is a JSON object. The call succeeds when the reply's status is `ok`, and fails as defined under Errors.

Each call sends one message. The SDK does not coalesce, debounce, or deduplicate calls, and it does not compare the payload with the last one it sent. The server counts every `presence` message on a channel, track and untrack alike, against a per-channel limit of 5 messages in a 30,000 ms window by default, which a project can change ([handler](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/realtime_channel/presence_handler.ex#L71-L86)). The message over the limit closes the channel, as defined under Errors. An app that updates presence often, such as a cursor position or a typing flag, throttles its own calls or sends that data by broadcast.

A track on a connection that is already tracked replaces its payload. Other clients see the change as a `join` of the new meta and a `leave` of the old meta under the same key ([Subscribe to Presence Events](../subscriptions/subscribe_presence.md)). A track with a payload equal to the connection's last tracked payload gets an `ok` reply and changes nothing.

Track works whether or not this client listens for presence. When the channel joined with presence off, a successful track turns presence on for it, and the server then sends a `presence_state`, which the SDK applies ([Get Presence State](presence_state.md)).

Track does not change the presence state the SDK holds. The new meta arrives in a `presence_diff`, on a channel with presence on, like any other client's.

The SDK does not track again after a rejoin. The server removes a connection's presence when its channel ends, so after a socket reconnect or a channel rejoin this client is no longer present on the channel. The app calls track again each time the channel reports that it joined. The SDK keeps no copy of the last payload to replay: a replay on every reconnect would count against the limit above, and the app may want a different payload after the gap.

## Prerequisites

The channel is joined.

## Errors

- Not joined: a track called while the channel is not joined, which covers before subscribe completes, after unsubscribe, and while the channel rejoins, fails with the SDK's own not-subscribed error and sends nothing. The SDK never buffers a presence message to send after a rejoin. A buffered message could time out, report failure to the app, and still reach the server after the rejoin as a track the app did not make, so its result would depend on whether the reconnect beat the timeout.
- Timeout: when no reply arrives within the timeout the app passes to the call, or the client's push timeout when it passes none, the call fails with the SDK's timeout error. The SDK does not retry, because the server may have applied the message.
- Server error: a reply with status `error` fails the call with the SDK's server error, which carries the reply's `response.reason` when the response has one. The server answers a payload that is not a JSON object with `{"reason": "Presence track payload must be a map"}`; the SDK's payload type accepts only JSON objects, so that answer cannot occur. Other failures, such as a missing `presence.write` policy on a private channel, reply with status `error` and an empty response ([channel](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/realtime_channel.ex#L508-L535)).
- Channel closed: when the channel closes or errors while a call waits for its reply, the SDK fails the call at once with its channel-closed error, without waiting for the timeout. No reply can arrive on a channel that is no longer joined, and the server removes this connection's presence when its channel ends, so nothing the call did survives. For three failures the server closes the channel instead of replying: it pushes a `system` message with status `error` and one of the messages `Client presence rate limit exceeded`, `Too many presence messages per second`, or `Track message size exceeded`, then closes the channel ([channel](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/realtime_channel.ex#L851-L856)). The channel does not rejoin after a close from the server: the app subscribes again.

## Related

- [Untrack Presence](untrack.md): removes the meta this call adds
- [Get Presence State](presence_state.md): where tracked metas appear
- [Custom Presence Key](presence_key.md): the key the meta goes under
