# Invocation Auth Token

Determine which authorization token a function invocation sends, without requiring the SDK to hold a mutable token on the functions client.

## Behavior

An invocation sends an `Authorization` header resolved from the first of these that applies:

1. **Per-call override.** A header passed to a single invocation wins over everything else, and applies only to that call.
2. **Access token provider.** A token supplied by the client, resolved fresh on every request. For a functions client owned by a `SupabaseClient`, this is the current session token, so the header follows sign-in, refresh, and sign-out with no further action. For a standalone functions client, this is whatever provider the caller passed at construction.
3. **Construction-time header.** An `Authorization` header passed when the functions client is built, used when there is no provider.

If none apply, the invocation carries no `Authorization` header. The API key header, where the SDK sends one, is independent of this capability.

An SDK satisfies this capability through any combination of the three that covers per-call override plus one non-per-call source. A stateful `setAuthToken(token)` mutator is one such source, but it is not required, and is not the preferred shape where the SDK can resolve a token per request instead.

## Notes

- **A per-call override must beat a live session token.** An SDK whose auth layer unconditionally overwrites `Authorization` breaks point 1 even though it appears to implement the capability. This is worth an explicit test rather than an assumption.
- **A stateful setter is a shadowing hazard.** A token pinned by a mutator outlives the session that was current when it was set: it keeps being sent after that session refreshes or signs out, and nothing clears it. SDKs that resolve the token per request avoid this by construction.
- Where a mutator does exist, its scope is the functions client alone. Cross-client propagation is [Cross-Client Token Synchronization](client.authentication_integration.cross_client_token_sync).

## Related

- [Invoke Function](functions.invocation.invoke) — the call this configures
- [Set Auth Token](realtime.client.set_auth_token) — Realtime's equivalent, which *is* a mutator: it holds a live socket and pushes a new token over it rather than attaching one per request
- [Cross-Client Token Synchronization](client.authentication_integration.cross_client_token_sync) — how the umbrella client keeps this token current
- [Third-Party Auth](client.authentication_integration.third_party_auth) — the construction-time token callback that feeds the provider in point 2
