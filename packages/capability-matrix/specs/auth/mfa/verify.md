# MFA Verify

Answer a challenge for a factor. On success the user's session is upgraded to authenticator assurance level 2 (AAL2).

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors/{factor_id}/verify`

## Behavior

The SDK sends the current session's access token as the bearer credential. The body carries the `challenge_id` from [challenge](challenge.md) and the proof:

- **TOTP and phone:** `code`, the one-time code as a string. The SDK does not trim or reformat it.
- **WebAuthn:** `webauthn` with the ceremony `type` (`create` or `request`, matching the challenge) and `credential_response`, the credential the platform's WebAuthn API produced, serialized to JSON with binary fields base64url-encoded.

The response is a complete new session with a new access token and a new refresh token. The old refresh token is behind the server's counter and is rejected, so the SDK must:

1. Replace the entire stored session with the response. It must not merge the response into the old session or keep the old refresh token.
2. Store the response's absolute `expires_at`, and compute it from `expires_in` when it is absent. The expiry may be shorter than the project's usual token lifetime.
3. Emit the MFA-challenge-verified auth event, carrying the new session, after the session is stored.
4. Return the new session to the caller.

A non-2xx response leaves the stored session unchanged and emits no event. A 2xx body that cannot be decoded as a session is a decoding error, never a server error, and also leaves the stored session unchanged.

## Prerequisites

An active session and a challenge that has not expired.

## Errors

- `mfa_challenge_expired`: the challenge is past `expires_at`. The application creates a new challenge.
- `mfa_verification_failed`: the code was wrong. The challenge may be answered again until it expires.

## Related

- [MFA Challenge](challenge.md): produces the `challenge_id`
- [MFA Challenge and Verify](challenge_and_verify.md): runs both calls
- [MFA Get Authenticator Assurance Level](get_authenticator_assurance_level.md): reports `aal2` after this call
- Subscribe to Auth Events (`auth.session.subscribe_auth_events`): delivers the MFA-challenge-verified event
