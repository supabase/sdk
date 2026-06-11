# Sign Up

Register a new user with an email+password or phone+password credential. On success, returns the created user and, if the project has confirmation disabled, an active session.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /signup`

### Email registration

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | yes | |
| `password` | string | yes | |
| `data` | object | no | Arbitrary metadata attached to the user record |
| `gotrue_meta_security.captcha_token` | string | no | Captcha verification token |
| `code_challenge` | string | conditional | PKCE — see [PKCE](#pkce) |
| `code_challenge_method` | string | conditional | `s256` — required when `code_challenge` is present |

**Query parameters**

| Parameter | Description |
|---|---|
| `redirect_to` | URL the user is sent to after confirming their email. Passed as a query parameter, not in the request body. |

### Phone registration

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | yes | |
| `password` | string | yes | |
| `data` | object | no | Arbitrary metadata attached to the user record |
| `channel` | string | no | OTP delivery method: `sms` (default) or `whatsapp` |
| `gotrue_meta_security.captcha_token` | string | no | Captcha verification token |

## Behavior

Accepts either an email+password or phone+password credential and optional metadata. Creates a new user account and returns `{ user, session }`.

`user` is always populated on success. Whether `session` is populated depends on the project's confirmation setting:

- **Confirmation required (default):** The server sends a confirmation email or OTP to the provided address. `session` is `null` until the user confirms. The SDK must not treat this as a sign-in.
- **Autoconfirm enabled:** The account is immediately active. Both `user` and `session` are returned. The SDK must persist the session and emit a sign-in event.

### PKCE

PKCE is supported for email registration when autoconfirm is off. The SDK derives a `S256` code challenge from a locally-generated code verifier and includes both `code_challenge` and `code_challenge_method` in the request body. The verifier is retained locally for the subsequent token exchange triggered by the confirmation link.

PKCE cannot be used when autoconfirm is on — no authorization code is issued in that flow.

## Prerequisites

The caller must not already have an active session. Signing up while authenticated creates a new independent account rather than adding credentials to the existing user.

## Errors

- `signup_disabled` — user registration is turned off for this project
- `weak_password` — the password does not satisfy the project's configured strength policy
- `email_address_invalid` — the email address is malformed or blocked by project settings
- `over_request_rate_limit` — too many requests; the caller should back off and retry

## Notes

The server intentionally obscures whether an address is already registered:

- **Email confirmation enabled:** if the email is already taken, the server returns an obfuscated error message that does not reveal account existence.
- **Both email and phone confirmation enabled:** if the account already exists, the server returns a fake user object (no session) that is indistinguishable from a genuine new registration.

SDKs must surface whatever the server returns without attempting to detect or special-case either scenario.

## Related

- [Verify OTP](auth.verify_otp) — required next step when sign-up triggers a confirmation flow
- [Resend Confirmation](auth.resend) — resend the confirmation email or OTP
- [Sign In with Password](auth.sign_in_with_password) — authenticate an already-registered account
