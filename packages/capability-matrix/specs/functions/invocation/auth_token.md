# Invocation Auth Token

Determine which authorization token a function invocation sends, without requiring the SDK to hold a mutable token on the functions client.

## API

There is no dedicated endpoint for this capability, as the token accompanies each invocation as `Authorization: Bearer <token>` ([RFC 6750, section 2.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1)), alongside the project API key.

## Behavior

An invocation sends the `Authorization` header from the first of these sources that yields a value:

1. **Per-call override.** An `Authorization` header passed to a single invocation, sent verbatim and only on that call.
2. **Access token provider.** A function the functions client calls on every invocation to obtain the current token. For a functions client owned by the top-level client, the provider returns the current session's access token (under Third-Party Auth, the result of the caller's token callback), or the project API key when there is no token, so the header follows sign-in, refresh, and sign-out with no action from the caller. For a standalone functions client, the provider is whatever the caller passed at construction, and a provider that yields no token falls through to the next source.
3. **Construction-time header.** An `Authorization` header passed when the functions client is built.

When no source yields a value, the invocation carries no `Authorization` header. The SDK adds the `Bearer` scheme to a token from source 2 and sends it without inspecting it. The project API key header is independent of this resolution.

Header names compare case-insensitively at every step: a per-call `authorization` header overrides the provider exactly as `Authorization` does, and the request never carries two authorization headers.

An SDK implements this capability when it supports the per-call override and at least one of sources 2 and 3. A mutator that stores a token on the functions client is one way to provide source 2, but it is not required, and resolving the token per request is preferred wherever the SDK can do so.

## Notes

- **A per-call override must beat a live session token.** An auth layer that writes `Authorization` on every request, regardless of what the call already set, breaks source 1 while still appearing to implement the capability. SDKs cover this with a test that passes an override on a client holding a session and asserts the override is what was sent.
- **A stored token is a shadowing hazard.** A token pinned by a mutator outlives the session that was current when it was set: it keeps being sent after that session refreshes or signs out, and nothing clears it. Resolving the token per request avoids this by construction.
- Where a mutator does exist, its scope is the functions client alone. Propagation across sub-clients is [Cross-Client Token Synchronization](../../client/authentication_integration/cross_client_token_sync.md).

## Related

- Invoke Function (`functions.invocation.invoke`): the call this configures
- Set Auth Token (`realtime.client.set_auth_token`): Realtime's equivalent, which is a mutator because it holds a live socket and has to push a new token over it rather than attach one per request
- [Cross-Client Token Synchronization](../../client/authentication_integration/cross_client_token_sync.md): how the top-level client keeps this token current
- [Third-Party Auth](../../client/authentication_integration/third_party_auth.md): the construction-time token callback that feeds the provider in source 2
