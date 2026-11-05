# Sign In with OAuth

Sign a user in with a third-party OAuth provider. The SDK starts a PKCE flow, builds the URL that sends the user to the provider through the Auth server, and finishes the flow with the redirect that comes back.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /authorize`

## Behavior

### The flow

The SDK always starts the flow with PKCE. It has no implicit mode and no configured flow type to choose one. Before it builds the URL, it starts a PKCE flow with the purpose `sign_in` and stores the flow's record, as [Concurrent PKCE Flows](concurrent_pkce_flows.md) defines. When storing the record fails, the call fails and no URL is built, so no URL exists without a stored verifier.

The URL is the Auth server's `/authorize` endpoint with these query parameters:

- `provider`: the provider the app named
- `scopes`: the scopes the app named, joined by a single space. The parameter is absent when the app named none
- `redirect_to`: the redirect URL the app passed to the call, else the redirect URL the client is configured with. The parameter is absent when neither exists
- `code_challenge` and `code_challenge_method`: the challenge of the flow's verifier, with the method `s256`
- the extra query parameters the app passed, after the parameters above

### Two forms

An SDK exposes the capability in one or both of these forms:

- **URL form.** The call returns the URL and the flow ID, and does nothing else. The app opens the URL itself. It then passes the redirect URL that comes back to the SDK's redirect handling (see Session URL Detection, `client.authentication_integration.session_url_detection`), or passes the code and the flow ID to Exchange Code for Session (`auth.sign_in.exchange_code_for_session`).
- **Presented form.** The call opens the URL through the platform's mechanism for web authentication, waits for the redirect URL, finishes the flow, and returns the session. SDKs that run in a browser navigate the page to the URL, and the session is found when the page loads again with the redirect.

In the presented form the SDK passes the redirect URL's scheme to the platform's mechanism, because the mechanism needs it to know which URL ends the flow. The redirect URL is the one `redirect_to` carries.

### Finishing the flow

The presented form hands the redirect URL to the SDK's redirect handling with the flow ID it started, so a second delivery of the same URL does not send a second request. The flow emits `SIGNED_IN`.

A sign-out that commits while the provider page is open wins over the redirect. The SDK stores no session, emits no event, and fails the call with its cancellation error.

### What happens to the flow record

| Event | Record |
| --- | --- |
| The platform's mechanism fails, or the user cancels it | removed |
| The code exchange succeeds | removed |
| The Auth server answers the exchange with an HTTP error | removed |
| The redirect carries an error, or is not an auth redirect | removed |
| The exchange gets no response | kept, so the app can retry with the same code |

## Errors

- The user cancels the presented form: the SDK's cancellation error, and no session change.
- The redirect URL reports an error, for example because the user denied access at the provider: the SDK's auth error, with the redirect's `error_code` and `error_description`, as Session URL Detection defines.
- The redirect URL is not an auth redirect, or reports a pending email change instead of a session: the SDK's auth error. No session is stored.

## Notes

- Stateless server-side SDKs hold no session and no pending flows, so they implement at most the URL form, with a verifier the app supplies.

## Related

- [Concurrent PKCE Flows](concurrent_pkce_flows.md): the flow record this call stores, and the verifier selection the exchange uses
- Exchange Code for Session (`auth.sign_in.exchange_code_for_session`): the exchange the redirect ends in
- Session URL Detection (`client.authentication_integration.session_url_detection`): how the redirect URL is read
