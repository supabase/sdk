# Broadcast via HTTP

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `POST /api/broadcast/{topic}/events/{event}`

## Behavior

The SDK sends one broadcast as one HTTP request to `{realtimeURL}/api/broadcast/{topic}/events/{event}`. It percent-encodes `topic` and `event` as path segments. For a private channel it adds `?private=true`. The request does not depend on the websocket: it works in every connection state, and the channel need not be subscribed.

The body carries the payload in one of two forms:

- A JSON payload: the SDK JSON-encodes it and sets `Content-Type: application/json`.
- Raw bytes: the SDK sends them unchanged and sets `Content-Type: application/octet-stream`.

The request starts from the headers the Realtime client is configured with. Those headers include `X-Client-Info` and, when the Realtime client belongs to an umbrella client, the umbrella client's global headers and `apikey`. The SDK then sets `Content-Type` as above and `Authorization: Bearer <access token>`, where the token is the client's current access token. These two headers replace any configured header of the same name.

The send succeeds on HTTP 202. Any other status fails with a server error. Its message is the `error` field of the response body when the body is a JSON object with that field, otherwise the `message` field when present.

`persist` is a per-message option of this capability. It travels in the query string, as [Persist Broadcast Message](broadcast_persist.md) defines.

### Timeout

The call takes an optional timeout. It is an idle timeout, with the same meaning as the per-request timeout of the SDK's other modules: the request fails once no data has moved in either direction for that long. It is not a total deadline. An app that needs one wraps the call.

When the app sets no timeout, the HTTP timeout of the client applies: the timeout of the Realtime module, or the global HTTP timeout when the module has none, which defaults to 60 seconds. The Realtime request and push timeout does not apply to this request.

A request that times out fails as a transport error whose cause is a timeout. There is no dedicated timeout error kind.

### Retry and cancellation

The SDK never retries this request, on any status or transport error, because a replay can deliver the broadcast to subscribers twice.

Cancelling the calling task cancels the request, and the call surfaces as cancellation, not as a transport or server error.

## Prerequisites

- The Realtime server is version 2.97.0 or later.

## Errors

- No access token: the SDK fails the call with its own error and sends nothing, because the request needs `Authorization: Bearer <access token>`.
- Any status other than 202: a server error carrying the message rule under Behavior.

## Related

- Broadcast Message (`realtime.channel.broadcast`): sends over the websocket
- [Persist Broadcast Message](broadcast_persist.md): `persist` over HTTP
- Private Channel (`realtime.subscriptions.private_channel`): the channels `?private=true` addresses
