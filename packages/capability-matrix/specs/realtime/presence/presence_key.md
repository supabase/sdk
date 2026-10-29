# Custom Presence Key

## API

Spec: [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol)

- `phx_join` (client to server): `config.presence.key`

## Behavior

The channel option `presence.key` is a string. When the app sets it to a non-empty string, the SDK sends it as `config.presence.key` in the join payload. Otherwise the SDK omits `config.presence.key`. Sending `""` instead is allowed, because the server treats a missing key and `""` the same, but omitting the field is preferred: it does not use an empty string to mean "no key".

The server picks a new UUID as the key for each join that carries no key or `""` ([join payload](https://github.com/supabase/realtime/blob/08be3e453e783d1842b5d81fd5e4d5dc83815823/lib/realtime_web/channels/payloads/join.ex#L41-L48)). A join assigns the key but adds no meta: a connection appears in the presence state only after it tracks, and the SDK does not track again after a rejoin ([Track Presence](track.md)). So without a custom key, when the app tracks again after a rejoin, its meta goes under a new key, and other clients see a `leave` of the old key and a `join` of the new one. With a custom key, the key holds across rejoins, and the meta the app tracks after the rejoin goes under the same key.

Every connection that joins a channel with the same key and tracks appears under that one key, with one meta per tracking connection ([Get Presence State](presence_state.md)). An app that sets the key to a user id sees one key per user and one meta per device or tab.

The key is part of the join payload, so it holds for the subscription and every rejoin of it. The SDK offers no call that changes the key of a joined channel: the app unsubscribes, sets the option, and subscribes again.

## Related

- [Track Presence](track.md): publishes a meta under this key
- [Untrack Presence](untrack.md): removes only this connection's meta under the key
- [Subscribe to Presence Events](../subscriptions/subscribe_presence.md): the key in `join` and `leave` payloads
