# Cross-Client Token Synchronization

Keep every sub-client (database, realtime, storage, functions) authenticated with the current user's JWT automatically, without the application manually re-configuring each one after sign-in, sign-out, or token refresh.

## Behavior

The top-level client listens for auth state changes — sign-in, sign-out, and token refresh — and propagates the resulting JWT (or its absence, on sign-out) to every sub-client it manages. Each sub-client uses whatever token it was most recently given for its own outgoing requests; the application never calls a sub-client-specific "set token" method itself under normal use.

The source of the JWT depends on which auth capability is active on the client:

- Under normal Supabase Auth, the source is the SDK's own session lifecycle (sign-in/refresh/sign-out events).
- Under [Third-Party Auth](client.authentication_integration.third_party_auth), the source is the caller-supplied async token callback instead, called on the same cadence the SDK would otherwise use its own session for.

Realtime's propagation composes with its own [Dynamic Access Token Callback](realtime.configuration.access_token_callback) mechanism — the top-level client's propagation and Realtime's per-connection refresh are two paths converging on the same "keep the socket's auth current" outcome.

## Prerequisites

Applies only to sub-clients constructed through the top-level client; a sub-client constructed and used standalone does not receive this propagation.

## Related

- [Third-Party Auth](client.authentication_integration.third_party_auth) — an alternative JWT source this propagation also serves
- [Dynamic Access Token Callback](realtime.configuration.access_token_callback) — Realtime's own token-refresh mechanism that this propagation composes with
