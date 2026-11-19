# MFA Challenge

Create a challenge for an enrolled factor. The challenge is the server-side record that a later [verify](verify.md) call answers.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors/{factor_id}/challenge`

## Behavior

The SDK sends the current session's access token as the bearer credential and returns the response body unchanged in meaning: the challenge `id`, the factor `type`, and `expires_at` as Unix time in seconds. The SDK does not convert `expires_at` into a duration and does not start a timer; the challenge expires on the server.

The request body depends on the factor type:

- **TOTP:** empty. The challenge only records that a code is expected.
- **Phone:** accepts an optional `channel`, `sms` or `whatsapp`. When absent, the SDK omits the field so the server applies its default. The server sends the one-time code to the factor's phone number.
- **WebAuthn:** accepts optional relying-party options. The response carries `webauthn` with the ceremony `type` (`create` or `request`) and `credential_options`, which the application passes to the platform's WebAuthn API. The server base64url-encodes their binary fields; an SDK that drives the platform ceremony itself decodes them before it calls the platform API.

## Prerequisites

An active session. The factor must belong to the session's user and may be verified or still unverified.

## Errors

- `mfa_challenge_expired`: returned by [verify](verify.md), not here. The SDK does not retry; the application creates a new challenge.
- `over_sms_send_rate_limit`: a phone challenge was rejected for sending too many messages. The SDK does not retry.

## Related

- [MFA Enroll](enroll.md): creates the factor this call challenges
- [MFA Verify](verify.md): answers the challenge
- [MFA Challenge and Verify](challenge_and_verify.md): combines both calls for code-based factors
