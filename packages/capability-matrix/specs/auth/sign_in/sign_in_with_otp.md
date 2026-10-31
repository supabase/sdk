# Sign In with OTP

Send a one-time code, and for email also a magic link, to an email address or a phone number. The call starts a sign-in and never returns a session: the user completes it with [Verify OTP](verify_otp.md) or by following the link.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /otp`

The OpenAPI entry does not document `redirect_to`. The handler reads it from the `redirect_to` query parameter or request header, never from the JSON body ([`getRedirectTo`](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/utilities/request.go#L142-L153)).

<!-- Delete the paragraph above once supabase/auth documents the redirect_to query
     parameter on /otp. No upstream issue is filed yet. -->

## Behavior

The request carries exactly one identifier, an email address or a phone number. The SDK's request type admits one and not both, and the other fields depend on which one it is:

| Field | Email | Phone | Where |
|---|---|---|---|
| `email` or `phone` | yes | yes | body |
| `create_user` | yes | yes | body |
| `data` | yes | yes | body |
| `gotrue_meta_security.captcha_token` | yes | yes | body |
| `redirect_to` | yes | no | query |
| `code_challenge`, `code_challenge_method` | PKCE flow only | no | body |
| `channel` | no | yes | body |

`create_user` is the wire name. The SDK always sends it, with the caller's value, and the value defaults to `true`, which is also the server's default when the field is absent ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/otp.go#L63-L66)). The server ignores any other name for this field, such as `should_create_user`, so an SDK that sends the caller's `false` under another name creates the user anyway.

`data` is user metadata. The SDK forwards it as given. It applies only when this call creates the user.

`channel` is `sms` or `whatsapp`. The SDK sends it only with a phone number, and sends `sms` when the caller names none.

`redirect_to` is the URL the magic link returns to. The SDK sends it as the `redirect_to` query parameter and never in the body, where the server does not read it. A phone request sends no `redirect_to`, because no link is sent.

### PKCE

When the client uses the PKCE flow, an email request starts a PKCE flow with the purpose `sign_in`, as defined in Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`), and sends `code_challenge` with `code_challenge_method` set to `s256`. The magic link then returns to `redirect_to` with a `code` that the SDK exchanges for a session. The emailed code still works with Verify OTP, which returns a session directly.

A phone request never starts a PKCE flow and sends no `code_challenge`: the server does not use one for a phone ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/otp.go#L101-L210)), and a phone code is only ever verified with Verify OTP.

### Result

The call does not change the stored session and emits no auth event.

- Email: the response body is an empty object, so the SDK returns nothing.
- Phone: the SDK returns the `message_id` from the response body, as an optional value. The body has no `message_id` when the SMS provider returns none, and when the call creates a user on a project that does not confirm phone numbers automatically, where the body is an empty object ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/otp.go#L182-L208)).

## Errors

- An email address and a phone number together, or neither: the request type does not admit them. An SDK whose language cannot express that raises its own argument error before any request is sent. The server answers both with HTTP 400 and error code `validation_failed`, with the messages `Only an email address or phone number should be provided` and `One of email or phone must be set`.
- A `channel` with an email address: the request type does not admit it. The server answers HTTP 400 with error code `validation_failed` and the message `Channel should only be specified with Phone OTP`.
- `otp_disabled` (HTTP 422): `create_user` is `false` and no user has this email address or phone number. The SDK surfaces it as is. It is the only way a caller learns that the account does not exist, so the SDK does not map it to a generic error.

## Related

- [Verify OTP](verify_otp.md): completes the sign-in with the code
- [Resend Confirmation](resend_confirmation.md): sends a new code for a sign-up or a contact change, not for this call
- [Sign Up](sign_up.md): creates a user with a password
- Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`): stores the code verifier the email request creates
- Exchange Code for Session (`auth.sign_in.exchange_code_for_session`): completes the magic link in the PKCE flow
