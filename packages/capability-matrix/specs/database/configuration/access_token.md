# Per-Request Access Token

Attach an end-user access token (JWT) to database requests so they execute under that user's Row Level Security policies instead of the API key's default role.

## API

Spec: [PostgREST Documentation: Authentication: JWT Authentication: Bearer Authentication](https://docs.postgrest.org/en/latest/references/auth.html#bearer-authentication)

There is no dedicated endpoint for this capability, as the access token accompanies each affected PostgREST request as `Authorization: Bearer <token>` ([RFC 6750, section 2.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1)), alongside the project API key.

## Behavior

The caller provides a raw token. The SDK adds the `Bearer` auth scheme, sending the token verbatim, without validating or inspecting it.

The token may be supplied by the caller as a value or provided by a caller-supplied callback function at request time.
A failure of the caller-supplied callback function must fail the request rather than attempting a client-side, SDK-led workaround such as downgrading it to a lower-privilege role.

The token applies to exactly the scope the caller chose - a single request, or a client scoped to that user.
Attaching a token never changes the authentication of any other client or request, including a client the scoped one was derived from.

The project API key keeps traveling with the request. The access token replaces only the authorization credential.

### Renewal

When the token is provided by a caller-supplied callback function and the server rejects it as invalid (HTTP `401`), the SDK may ask the function for a new token and re-send the request with the result ([RFC 6750, section 3.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1)), repeating while rejections continue.

Renewal must terminate eventually - it cannot be allowed to loop indefinitely.
SDKs must cap re-sends of any one request at a small, fixed count (sharing an existing retry limit is fine - e.g. `database.configuration.auto_retry`) and, once the cap is spent, surface the server's latest authentication error as the request's outcome.

The token value stays opaque throughout.
SDKs must not compare, parse or otherwise inspect token bytes to steer renewal.

## Prerequisites

The access token must be a JWT the project accepts, issued by Supabase Auth or by an external provider the project trusts.

## Errors

Server-side authentication errors (for example PostgREST's [`PGRST301`](https://docs.postgrest.org/en/latest/references/errors.html#pgrst301) / HTTP `401`) apply as for any other request.

## Related

- [Third-Party Auth](../../client/authentication_integration/third_party_auth.md) - construction-time token callback that sources tokens for all sub-clients; this capability scopes a token to specific database requests instead
- `database.configuration.auto_retry`
