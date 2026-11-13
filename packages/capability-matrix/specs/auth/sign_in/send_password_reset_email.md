# Send Password Reset Email

Send a password reset link and code to an email address. The call does not change the password: following the link, or verifying the code, signs the user in for recovery, and the app then sets the new password with Update User.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /recover`

The OpenAPI entry does not document `redirect_to`. The handler reads it from the `redirect_to` query parameter or request header, never from the JSON body ([`getRedirectTo`](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/utilities/request.go#L142-L153)).

<!-- Delete the paragraph above once supabase/auth documents the redirect_to query
     parameter on /recover. No upstream issue is filed yet. -->

## Behavior

The body carries `email` and `gotrue_meta_security.captcha_token`. The SDK sends `redirect_to` as a query parameter and never in the body.

The call does not change the stored session and emits no auth event. The response body is an empty object, both when a user has the email address and when none does ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/recover.go#L51-L57)), so the SDK returns nothing and a success does not mean that an account exists.

### PKCE

When the client uses the PKCE flow, the call starts a PKCE flow with the purpose `recovery`, as defined in Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`), and sends `code_challenge` with `code_challenge_method` set to `s256`. The purpose is what makes the later code exchange emit `PASSWORD_RECOVERY` instead of `SIGNED_IN`: the redirect carries only a `code`, and nothing in it or in the server's token response says that the flow was a recovery. An SDK that stores the verifier without the purpose cannot emit the right event.

### Completing the reset

The user completes the reset in one of three ways, and each emits `PASSWORD_RECOVERY` once the SDK stores the session:

1. The link, in the PKCE flow: the redirect carries a `code`, and the SDK exchanges it with the stored verifier.
2. The link, in the implicit flow: the redirect carries tokens and `type=recovery`.
3. The code in the email: the app calls [Verify OTP](verify_otp.md) with the type `recovery`.

The app sets the new password with Update User while that session is stored. The SDK does not set a password as part of this call or of the event.

## Related

- [Verify OTP](verify_otp.md): completes the reset with the emailed code
- Update User (`auth.session.update_user`): sets the new password
- Session URL Detection (`client.authentication_integration.session_url_detection`): completes the reset from the link
- Concurrent PKCE Flows (`auth.sign_in.concurrent_pkce_flows`): stores the code verifier with the `recovery` purpose
- [Reauthenticate](reauthenticate.md): sends the `nonce` that a signed-in user's password change can need
