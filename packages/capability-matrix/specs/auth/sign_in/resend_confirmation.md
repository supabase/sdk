# Resend Confirmation

Send a new code, and for email also a new link, for a pending sign-up confirmation or a pending email or phone change. The call returns no session.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /resend`

The OpenAPI entry does not document `code_challenge`, `code_challenge_method`, or the `redirect_to` query parameter. The handler reads the first two from the body for the types `signup` and `email_change` ([`Validate`](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/resend.go#L26-L35)), and reads `redirect_to` from the query string or a request header, never from the JSON body ([`getRedirectTo`](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/utilities/request.go#L142-L153)).

<!-- Delete the paragraph above once supabase/auth documents these parameters on
     /resend. No upstream issue is filed yet. -->

## Behavior

The SDK's request type pairs each type with one identifier:

| Type | Identifier | What it resends |
|---|---|---|
| `signup` | `email` | the sign-up confirmation |
| `email_change` | `email` | the confirmation of a pending email change |
| `sms` | `phone` | the sign-up confirmation by SMS |
| `phone_change` | `phone` | the confirmation of a pending phone change |

For `email_change` and `phone_change`, the identifier is the user's current email address or phone number, which the server uses to find the user. The server sends the code to the pending new address or number, which the request does not carry.

The other fields:

- `gotrue_meta_security.captcha_token` in the body, for every type.
- `redirect_to` as a query parameter, for `signup` and `email_change` only, never in the body. A phone type sends no `redirect_to`, because no link is sent.
- No `channel`. The server sends every phone code by SMS on this route ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/resend.go#L136-L160)), so the SDK offers no channel option.

### PKCE

When the client uses the PKCE flow, the types `signup` and `email_change` start a PKCE flow, as defined in Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`), and send `code_challenge` with `code_challenge_method` set to `s256`. The purpose is `email_change` for `email_change` and `sign_in` for `signup`, so the link emits the same event as the link from the original request. A phone type never starts a PKCE flow.

### Result

The call does not change the stored session and emits no auth event.

The SDK returns the `message_id` from the response body, as an optional value, for `sms` and `phone_change`. For the email types the body is an empty object and the SDK returns nothing. The server also answers HTTP 200 with an empty object when no user has the identifier or when nothing is pending, such as a sign-up that is already confirmed ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/resend.go#L93-L117)). So a success does not mean that a message was sent, and the SDK does not claim that it was.

## Errors

- A type with the other kind of identifier, such as `sms` with an email address: the request type does not admit it. The server answers a missing identifier with HTTP 400, error code `validation_failed`, and the message `Type provided requires an email address` or `Type provided requires a phone number`.
- A type outside the four above, such as `recovery` or `magiclink`: the request type does not admit it. The server answers HTTP 400 with error code `validation_failed` and the message `Missing one of these types: signup, email_change, sms, phone_change`. A magic link or a password reset is sent again by calling [Sign In with OTP](sign_in_with_otp.md) or [Send Password Reset Email](send_password_reset_email.md) again.

## Related

- [Verify OTP](verify_otp.md): verifies the new code, with the same type
- [Sign Up](sign_up.md): sends the first `signup` or `sms` confirmation
- Update User (`auth.session.update_user`): sends the first `email_change` or `phone_change` confirmation
- Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`): stores the code verifier the email types create
