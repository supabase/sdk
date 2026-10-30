# Persist Broadcast Message

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `broadcast` (client to server), protocol 2.0.0 user broadcast frame: `persist` in the frame metadata
- `POST /api/broadcast/{topic}/events/{event}`: `persist` in the query string

## Behavior

`persist` is a per-message option of Broadcast Message and Broadcast via HTTP. It takes `true`, or an object with an optional `ttl` in seconds. `true` and an object without `ttl` both store the message for the maximum retention. When the app leaves it out or passes `false`, the SDK sends no `persist` at all.

Over the websocket, the SDK sends `persist` in the metadata of the user broadcast frame, as `{"persist": true}` or `{"persist": {"ttl": 3600}}`, and never in the payload. The server reads `persist` only from the metadata ([`persist_option`](https://github.com/supabase/realtime/blob/cea1926d4befd8b4e75d550c72931317ad081f77/lib/realtime_web/channels/realtime_channel/broadcast_handler.ex#L326-L327)), so a `persist` key in the payload is delivered to subscribers as data and stores nothing.

Over HTTP, the SDK sends `persist=true` or `persist[ttl]=3600` in the query string, and never in the body. The server reads `persist` only from the query string, so a `persist` key in the JSON body is delivered as data.

The SDK sends `ttl` as the app gave it and does not check its range, because the server owns the maximum retention and the SDK would otherwise need a release when it changes.

When the channel has `broadcast.ack` set, the server answers a message it did not store with an error reply whose body is `{"error": code}` ([error reply](https://github.com/supabase/realtime/blob/cea1926d4befd8b4e75d550c72931317ad081f77/lib/realtime_web/channels/realtime_channel/broadcast_handler.ex#L111-L114)), so the SDK resolves the send with that code instead of a generic error:

- `persistence_unauthorized`: the sender has no `persistence` policy. The message was delivered but not stored.
- `persistence_failed`: the insert failed. The message was delivered but not stored.
- `invalid_persist_ttl`: the server refused the `ttl`. The message was neither delivered nor stored.

Without `broadcast.ack`, the server sends no reply for these, so the SDK cannot tell the app whether the message was stored.

## Prerequisites

- The channel is private: its `private` option is `true`.
- Over the websocket, the client uses protocol 2.0.0, whose user broadcast frame carries metadata.

## Errors

- `persist` on a channel whose `private` option is not `true`: the SDK fails the send with its own error and sends nothing. Over the websocket, the server ignores `persist` on a public channel and, when the channel has `broadcast.ack` set, replies `ok` ([public handler](https://github.com/supabase/realtime/blob/cea1926d4befd8b4e75d550c72931317ad081f77/lib/realtime_web/channels/realtime_channel/broadcast_handler.ex#L78-L94)), so without this check the app reads a message that was never stored as a success. Over HTTP, the check pre-empts HTTP 422 with `{"errors": {"persist": ["can only be used on private channels"]}}`.
- `persist` over the websocket with protocol 1.0.0: the SDK fails the send with its own error and sends nothing. The server reads no `persist` from a 1.0.0 frame and, when the channel has `broadcast.ack` set, replies `ok`.
- `persist` on a send that falls back to the batch endpoint `POST /api/broadcast` because the channel is not joined: the SDK fails the send with its own error and sends nothing. The batch endpoint ignores `persist` and answers HTTP 202.
- A `ttl` the server refuses over HTTP: the server answers HTTP 422 with `{"message": "persist ttl must be a positive integer of seconds from 1 to <maximum>"}`, and the SDK raises that message.

## Related

- Broadcast Message (`realtime.channel.broadcast`): carries `persist` over the websocket
- Broadcast via HTTP (`realtime.channel.broadcast_http`): carries `persist` over HTTP
- Broadcast Acknowledgment (`realtime.subscriptions.broadcast_ack`): needed to learn whether a message was stored
- Broadcast Message Replay (`realtime.subscriptions.broadcast_replay`): replays stored messages on join
- Private Channel (RLS) (`realtime.subscriptions.private_channel`): required for `persist`
