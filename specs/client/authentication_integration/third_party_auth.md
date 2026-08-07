# Third-Party Auth

Let an application supply its own external auth provider (e.g. Clerk, Auth0, a custom auth backend) instead of Supabase Auth, while still authenticating requests to the database, storage, realtime, and functions sub-clients.

## Behavior

At construction time, the caller provides an async callback that returns the current JWT (or `null` if unauthenticated) issued by their external provider. When this callback is supplied:

- The SDK does not construct its own Supabase Auth client — sign-in, sign-up, session, and MFA capabilities in the `auth` area are not available on this client instance.
- Before each outgoing request, the SDK calls the callback and injects the returned JWT as the request's authorization credential, the same way it would inject a Supabase Auth session token.
- The JWT must be one Supabase's backend accepts for the project (a valid signature and claims Supabase is configured to trust) — this capability does not itself change what tokens the server accepts, only how the client sources the token it sends.

If the callback returns `null` or rejects, the request proceeds unauthenticated (as the project's anon key) rather than failing the call outright, matching the client's behavior when no session exists under normal Supabase Auth.

## Prerequisites

The Supabase project must be configured to accept JWTs from the external provider (verification is a server-side project setting, not a client capability).

## Related

- [Cross-Client Token Synchronization](client.authentication_integration.cross_client_token_sync) — the propagation mechanism this capability relies on to reach the database/storage/realtime/functions sub-clients; when third-party auth is active, that propagation is driven by this callback instead of Supabase Auth's own session events
