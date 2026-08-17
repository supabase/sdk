# Third-Party Auth

Let an application supply its own external auth provider (e.g. Clerk, Auth0, a custom auth backend) instead of Supabase Auth, while still authenticating requests to the database, storage, realtime, and functions sub-clients.

## Behavior

At construction time, the caller provides an async callback that returns the current JWT (or `null` if unauthenticated) issued by their external provider. When this callback is supplied:

- The SDK does not construct its own Supabase Auth client — sign-in, sign-up, session, and MFA capabilities in the `auth` area are not available on this client instance.
- Before each outgoing request, the SDK calls the callback and injects the returned JWT as the request's authorization credential, the same way it would inject a Supabase Auth session token.
- The JWT must be one Supabase's backend accepts for the project (a valid signature and claims Supabase is configured to trust) — this capability does not itself change what tokens the server accepts, only how the client sources the token it sends.

If the callback returns `null`, the request proceeds unauthenticated (as the project's anon key), matching the client's behavior when no session exists under normal Supabase Auth.

If the callback rejects or throws, the SDK does not fall back to the anon key: the error propagates out of the request that triggered it (e.g. a `from().select()` call, a `functions.invoke()` call), and that call fails. A throwing callback means "the caller's identity could not be resolved," not "this request doesn't need one" — the SDK must not convert that failure into a silent, lower-privilege request.

## Prerequisites

The Supabase project must be configured to accept JWTs from the external provider (verification is a server-side project setting, not a client capability).

## Notes

- Implementations must not wrap the callback invocation in a catch-and-return-null (or equivalent) — doing so masks token-provider failures as "no session," which can let a request that was meant to carry the caller's identity go out anonymously instead of surfacing the error.

## Related

- [Cross-Client Token Synchronization](client.authentication_integration.cross_client_token_sync) — the propagation mechanism this capability relies on to reach the database/storage/realtime/functions sub-clients; when third-party auth is active, that propagation is driven by this callback instead of Supabase Auth's own session events
