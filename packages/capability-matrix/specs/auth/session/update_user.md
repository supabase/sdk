# Update User

Change the signed-in user's email, phone, password, or user metadata.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `PUT /user`

The OpenAPI entry omits the `current_password`, `code_challenge`, and `code_challenge_method` body fields and the `redirect_to` query parameter, and it documents only the 400 and 429 responses. The handler, [`UserUpdate`](https://github.com/supabase/auth/blob/master/internal/api/user.go), reads all four and also answers 401, 403, and 422.

<!-- Delete the paragraph above once supabase/auth#<issue> corrects the entry:
     <issue URL> -->

## Behavior

The request carries the current session's access token as its bearer credential. SDKs that hold a session use the stored session's token. Stateless server-side SDKs take the access token as an explicit input.

The SDK sends only the fields the caller set. It never sends `null` or an empty string for a field the caller left out. The server reads an empty `email` or `phone` as "no change", but it reads an empty `password` as a new password, and it answers 422 `weak_password`.

The SDK sends `data` as the caller gave it, and it keeps explicit `null` values inside it. The server merges `data` into the user metadata key by key, and a key whose value is `null` is removed. So an encoder that drops `null` values turns "remove this key" into "leave this key".

The request type does not expose `app_metadata`. The server answers a user token that sets it with 403 `not_admin`.

The caller's email redirect URL goes in the `redirect_to` query parameter, not in the body.

`current_password` and `nonce` are forwarded as given. The SDK does not read, store, or cache either value. A `nonce` comes from [Reauthenticate](auth.sign_in.reauthenticate). The SDK does not check before the wire whether the project needs either field, because it cannot see the project's settings. See [Password security](https://supabase.com/docs/guides/auth/password-security) for when the server asks for them.

### PKCE for email change

When the client uses the PKCE flow and the caller sets `email`, the SDK makes a code verifier. It sends the S256 challenge as `code_challenge` and `s256` as `code_challenge_method`. It stores the verifier as [Concurrent PKCE Flows](../sign_in/concurrent_pkce_flows.md) describes. The confirmation link later carries a code, and the app exchanges it with Exchange Code for Session (`auth.sign_in.exchange_code_for_session`). When `email` is not set, the SDK sends no challenge and stores no verifier. When the request fails, the SDK removes the verifier it stored for this call.

### Session update

A 200 response carries the updated user. The SDK returns that user as the server sent it. A pending email or phone change shows in `new_email` or `new_phone`, and `email` and `phone` keep the old values until the change is confirmed. So the SDK never copies the requested email or phone into the user.

SDKs that hold a session then do these steps, in this order:

1. Read the session that is stored when the response arrives. Do not use a copy read before the request. A token refresh can finish while the request is in flight. It rotates the refresh token, and a write of the older copy restores a refresh token that the server has already used. The next refresh then fails and signs the user out.
2. If no session is stored, or the stored session's user id is not the returned user's id, stop. Do not create or change a session. Still return the user.
3. Replace the stored session's user with the returned user. Keep its tokens. Persist it.
4. Emit the user-updated event with the merged session.

A non-2xx response changes no stored state and emits no event.

## Errors

- No session: SDKs that hold a session raise their session-missing error and send no request.
- `insufficient_aal` (401): the user has MFA and the session is AAL1, and the call changes email, phone, or password. This 401 does not mean the token is bad. The SDK must not clear the session or emit a sign-out for it. The caller completes an MFA challenge and retries.
- `reauthentication_needed` (400) and `reauthentication_not_valid` (422): the password change needs a valid `nonce`. The caller calls Reauthenticate and retries with the code the user received.
- `current_password_required` (400) and `current_password_invalid` (400): the project needs the current password for a password change. The server skips this check in a recovery session.
- `same_password`, `email_exists`, `phone_exists`, `user_sso_managed`, `weak_password` (all 422): passed through.

The SDK surfaces each of these as the server error type with its `error_code`. It does not retry any of them.

## Notes

- The access token keeps the claims it had at issue. After a change, [Get Claims](get_claims.md) still returns the old email and user metadata until the next refresh. A caller that needs fresh claims calls Refresh Session (`auth.session.refresh_session`).

## Related

- [Get User](get_user.md): reads the same user resource without a change
- [Concurrent PKCE Flows](../sign_in/concurrent_pkce_flows.md): how the email-change verifier is stored
- Reauthenticate (`auth.sign_in.reauthenticate`): sends the `nonce` a password change can need
- Subscribe to Auth Events (`auth.session.subscribe_auth_events`): carries the user-updated event
