# Link Identity

Link an OAuth or OIDC identity to the signed-in user. The SDK offers two paths. The OAuth path sends the user to the provider and links in a later callback. The ID-token path links at once with an ID token the app already holds.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /user/identities/authorize` - the OAuth path
- `POST /token?grant_type=id_token` with `link_identity: true` - the ID-token path

The OpenAPI entry for `/user/identities/authorize` omits the `skip_http_redirect` and `code_challenge` query parameters and documents only the 302 response. The handler, [`LinkIdentity`](https://github.com/supabase/auth/blob/master/internal/api/identity.go), answers 200 with a JSON body `{"url": ...}` when `skip_http_redirect=true`. The `/token` entry omits the `link_identity` body field, which [`IdTokenGrant`](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go) reads.

<!-- Delete the paragraph above once supabase/auth#<issue> corrects the entry:
     <issue URL> -->

## Behavior

Both paths send the current session's access token as the `Authorization` bearer credential, in place of the API key that requests without a user carry there. The server links the identity to the user that token names. SDKs that hold a session use the stored session's token. Stateless server-side SDKs take the access token as an explicit input.

### OAuth path

The SDK sends the request with these query parameters: `provider`, `scopes` (space-separated) when the caller gives scopes, `redirect_to` when the caller gives a redirect URL, the caller's extra query parameters, and `skip_http_redirect=true`. The SDK always sends `skip_http_redirect=true` and reads `url` from the 200 body. Without it the server answers 302, and an HTTP client that follows redirects fetches the provider's page instead of giving the SDK the URL.

When the client uses the PKCE flow, the SDK makes a code verifier. It sends the S256 challenge as the `code_challenge` query parameter and `s256` as `code_challenge_method`. It stores the verifier as [Concurrent PKCE Flows](../sign_in/concurrent_pkce_flows.md) describes, and it marks that stored flow as a link flow. It returns the flow id with the URL. When the request fails, the SDK removes the verifier it stored for this call.

The call returns the provider name, the URL, and the flow id when there is one. It does not change the stored session and emits no event. The app opens the URL. An SDK that runs in a browser may navigate to it unless the caller opts out.

The provider then redirects to `redirect_to` with an authorization code. Exchange Code for Session (`auth.sign_in.exchange_code_for_session`) turns the code into a new session for the same user, now with the new identity. When the exchanged flow is marked as a link flow, the SDK stores the new session and emits the user-updated event, not the signed-in event. The user is the same, so a signed-in event would tell listeners that someone new signed in. In the implicit flow there is no stored flow to mark, and the callback follows the normal rules for a session read from the URL.

### ID-token path

The SDK sends `provider`, `id_token`, `access_token` and `nonce` when the caller gives them, captcha data when the caller gives it, and `link_identity: true`.

A 200 response carries a new session for the same user, now with the new identity. SDKs that hold a session replace the stored session with it, persist it, and emit the user-updated event, not the signed-in event. A 200 response without both a session and a user is an invalid-response error, and the SDK does not change the stored session.

## Prerequisites

The OAuth path needs manual linking turned on for the project. When it is off, the server answers 404 `manual_linking_disabled`. See [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Errors

- No session: SDKs that hold a session raise their session-missing error and send no request.
- `manual_linking_disabled` (404): passed through. It is a project setting, not a missing endpoint and not a session error. The SDK does not retry it.
- `identity_already_exists` (422): the identity is already linked to this user or to another user. The ID-token path gets it in the response body. The OAuth path gets it in the error parameters of the callback redirect, and the SDK surfaces it there as it surfaces any OAuth callback error.
- No request error on either path clears the stored session.

## Related

- [Concurrent PKCE Flows](../sign_in/concurrent_pkce_flows.md): how the verifier and flow id are stored
- [List Identities](list_identities.md): reads the identities after a link
- [Unlink Identity](unlink_identity.md): the reverse operation
- Sign In with OAuth (`auth.sign_in.sign_in_with_oauth`): the sign-in flow the OAuth path mirrors
- Sign In with ID Token (`auth.sign_in.sign_in_with_id_token`): the sign-in flow the ID-token path mirrors
- Exchange Code for Session (`auth.sign_in.exchange_code_for_session`): finishes the OAuth path
