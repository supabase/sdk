# Sign In with SSO

Start a SAML single sign-on for an identity provider, chosen by its provider ID or by an email domain. The call returns the identity provider's URL. The user signs in there, and the server redirects back to the app, which completes the sign-in.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /sso`

## Behavior

### Request

The SDK's request type admits exactly one of `provider_id` and `domain`. Every field goes in the JSON body, `redirect_to` included: this route reads `redirect_to` from the body and not from the query string, unlike the routes that send email ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/sso.go#L13-L20)).

- `provider_id` or `domain`.
- `redirect_to`: the URL the server returns to after the identity provider. When it is not on the project's redirect allow list, the server uses the Site URL instead ([`handleSamlAcs`](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/samlacs.go#L363-L365)).
- `skip_http_redirect`: always `true`, and the caller cannot change it. Without it the server answers HTTP 303 with the identity provider's URL in `Location` ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/sso.go#L147-L160)), and an HTTP client that follows redirects fetches the identity provider's sign-in page instead of returning its URL.
- `gotrue_meta_security.captcha_token`.
- `code_challenge` and `code_challenge_method` in the PKCE flow, as below.

### PKCE

When the client uses the PKCE flow, the call starts a PKCE flow with the purpose `sign_in`, as defined in Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`), and sends `code_challenge` with `code_challenge_method` set to `s256`. The server then redirects to `redirect_to` with a `code`, which the SDK exchanges with the stored verifier. In the implicit flow the redirect carries the tokens in the URL fragment instead.

### Result

The response body is `{"url": ...}`. The SDK returns the URL. The call does not change the stored session and emits no auth event: the session arrives only when the redirect completes, through Session URL Detection or Exchange Code for Session, which emits `SIGNED_IN`.

An SDK on a platform that can open a browser may also offer a call that opens the URL and completes the flow when the browser returns to `redirect_to`, for example in a system authentication session on a mobile platform. That call still starts the flow as above, and completes it through the same exchange. The call that only returns the URL exists on every platform, so an app can open the URL itself.

## Errors

- `provider_id` and `domain` together, or neither: the request type does not admit them. An SDK whose language cannot express that raises its own argument error before any request is sent, which pre-empts HTTP 400 with error code `validation_failed` and the message `Only one of provider_id or domain supported` or `A provider_id or domain needs to be provided`.
- A `provider_id` that is not a UUID: the SDK raises its own argument error before any request is sent. The server cannot decode the body and answers HTTP 400 with error code `bad_json`. The SDK accepts the canonical hyphenated form, 32 hexadecimal digits in groups of 8, 4, 4, 4, and 12, in either case.
- `sso_provider_not_found` (HTTP 404): no provider has this ID, or no provider is assigned to this domain. `sso_provider_disabled` (HTTP 404): the provider exists and is disabled. `saml_provider_disabled` (HTTP 404): SAML is off for the project. The SDK surfaces each as is.

## Notes

The convenience call that opens a browser is platform-scoped. An SDK for a platform with no browser to open, such as a server runtime, offers only the call that returns the URL and still declares this feature `implemented`.

## Related

- Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`): stores the code verifier and flow ID
- Session URL Detection (`client.authentication_integration.session_url_detection`): completes the sign-in from the redirect
- Exchange Code for Session (`auth.sign_in.exchange_code_for_session`): completes the sign-in with the code
- Sign In with OAuth (`auth.sign_in.sign_in_with_oauth`): the same redirect flow for OAuth providers
- Create SSO Provider (`auth.sso_admin.create_provider`): registers the providers this call signs in with
