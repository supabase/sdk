# Cross-Client Token Synchronization

Keep every sub-client (database, realtime, storage, functions) authenticated with the current user's JWT automatically, without the application manually re-configuring each one after sign-in, sign-out, or token refresh.

## Behavior

After sign-in, token refresh, or sign-out, the next request from every sub-client the top-level client manages carries the current user's JWT, or the project API key in its place after sign-out. The application never calls a sub-client-specific "set token" method itself under normal use.

The mechanism is open. The top-level client may push the token to each sub-client on auth state change events, or each sub-client may resolve it from the top-level client on every request. Resolving per request is preferred where the sub-client attaches the token per request, since it leaves no stored token to go stale. Realtime is the exception: it holds a live socket, so a new token has to be pushed over it.

The source of the JWT depends on which auth capability is active on the client:

- Under normal Supabase Auth, the source is the SDK's own session lifecycle (sign-in/refresh/sign-out events).
- Under [Third-Party Auth](third_party_auth.md), the source is the caller-supplied async token callback instead, called on the same cadence the SDK would otherwise use its own session for.

Realtime's propagation composes with its own Dynamic Access Token Callback (`realtime.configuration.access_token_callback`) mechanism: the top-level client's propagation and Realtime's per-connection refresh are two paths converging on the same "keep the socket's auth current" outcome.

## Prerequisites

Applies only to sub-clients constructed through the top-level client; a sub-client constructed and used standalone does not receive this propagation.

## Related

- [Third-Party Auth](third_party_auth.md): an alternative JWT source this propagation also serves
- Dynamic Access Token Callback (`realtime.configuration.access_token_callback`): Realtime's own token-refresh mechanism that this propagation composes with
