# Reauthenticate

Send a one-time code to the signed-in user's email address or phone number. The code is the `nonce` that Update User sends with a new password when the project requires reauthentication for password changes.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /reauthenticate`

The OpenAPI entry documents `POST`. The server routes only `GET` ([routes](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/api.go#L277-L279)), so the SDK sends `GET`, with no body.

<!-- Delete the paragraph above once supabase/auth corrects the method of the
     /reauthenticate entry. No upstream issue is filed yet. -->

## Prerequisites

A stored session. The SDK sends its access token in the `Authorization` header, after it refreshes an expired session as it does for every call that needs the session.

## Behavior

The server picks the destination from the user record: the email address when the user has one, otherwise the phone number ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/reauthenticate.go#L17-L67)). The request has no field to choose it.

The call does not change the stored session and emits no auth event. The SDK returns the `message_id` from the response body as an optional value. It is present only when the code went by SMS and the provider returned one, and the body is an empty object otherwise.

The code the user receives is passed to Update User as `nonce`, together with the new password. The SDK does not store or cache it.

## Errors

- No stored session: the SDK raises its own session-missing error before any request is sent, which pre-empts HTTP 401 with error code `no_authorization`.
- `email_not_confirmed` or `phone_not_confirmed` (HTTP 422): the user's email address, or phone number when there is no email address, is not confirmed. The SDK surfaces it as is.

## Related

- Update User (`auth.session.update_user`): sends the code as `nonce` with the new password
- [Send Password Reset Email](send_password_reset_email.md): the password change for a user who cannot sign in
