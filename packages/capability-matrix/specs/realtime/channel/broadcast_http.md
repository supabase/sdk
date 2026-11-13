# Broadcast via HTTP

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `POST /api/broadcast/{topic}/events/{event}`

## Behavior

The SDK sends one broadcast as one HTTP request to `{realtimeURL}/api/broadcast/{topic}/events/{event}`. It percent-encodes `topic` and `event` as path segments. For a private channel it adds `?private=true`. The request does not depend on the websocket: it works in every connection state, and the channel need not be subscribed.

The body carries the payload in one of two forms:

- A JSON payload: the SDK JSON-encodes it and sets `Content-Type: application/json`.
- Raw bytes: the SDK sends them unchanged and sets `Content-Type: application/octet-stream`.

The request starts from the headers the Realtime client is configured with. Those headers include `X-Client-Info` and, when the Realtime client belongs to an umbrella client, the umbrella client's global headers and `apikey`. The SDK then sets `Content-Type` as above. When the client has an access token, it also sets `Authorization: Bearer <access token>`. These headers replace any configured header of the same name.

`apikey` alone authenticates the request on a public channel, so the SDK sends the request without `Authorization` when it has no access token. A private channel needs a token that the channel's RLS policies accept; without one the server refuses the request.

The send succeeds on HTTP 202. Any other status fails with a server error. Its message is the `error` field of the response body when the body is a JSON object with that field, otherwise the `message` field when present.

`persist` is a per-message option of this capability. It travels in the query string, as [Persist Broadcast Message](broadcast_persist.md) defines.

### Timeout

The call takes an optional timeout. It bounds the whole call, with the same meaning as the client's other Realtime timeouts (join, push with acknowledgement, leave). When the app sets no timeout, the client's Realtime request timeout applies, which defaults to 10 seconds. A call that runs past it fails with the same timeout error those operations use.

The client's HTTP idle timeout still applies to the request underneath: the request fails as a transport error once no data has moved for that long.

### Retry

The SDK never retries this request, on any status or transport error, because a replay can deliver the broadcast to subscribers twice.

## Prerequisites

- The Realtime server is version 2.147.0 or later. The endpoint exists from 2.97.0, but before 2.147.0 the server also reads `private` from a JSON body, so a payload with a top-level `private` key can move a private broadcast to the public topic and skip the private channel's RLS check.
- `persist` needs version 2.150.0 or later. Older servers ignore it and still answer 202, without storing the message.

## Errors

- Any status other than 202: a server error carrying the message rule under Behavior.

## Related

- Broadcast Message (`realtime.channel.broadcast`): sends over the websocket
- [Persist Broadcast Message](broadcast_persist.md): `persist` over HTTP
- Private Channel (`realtime.subscriptions.private_channel`): the channels `?private=true` addresses
