# Get User

Fetch the authenticated user's profile from the Auth server. The server authenticates the presented access token before answering, so a successful response does double duty: it returns the profile and it proves the token is currently valid and its session has not been revoked - a guarantee local verification cannot provide, because revocation is server-side state.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /user`

## Behavior

The input is a JWT access token, sent as the request's bearer credential. SDKs that hold a session default to the current session's access token when none is supplied, and stateless server-side SDKs require it explicitly.

The server verifies the token - signature, expiry and that the session it belongs to still exists - and on success returns the user resource as it stands now: id, audience, role, email and phone with their confirmation timestamps, app and user metadata, linked identities and account timestamps. This is authoritative current state, unlike token claims, which are a snapshot minted at token issuance.

A non-2xx response carries the server's stable error code and message, which SDKs surface as a typed error.

## Errors

- `bad_jwt` - the token failed the server's verification (bad signature, expired or otherwise unacceptable)
- `session_not_found` - the token's session no longer exists, for example after sign-out or revocation
- `user_banned` - the account is banned

## Notes

- This is a network round trip on every call. Request paths that only need verified identity should prefer [Get Claims](auth.session.get_claims), which verifies locally against the project's published public keys on its fast path.
- Because the server re-checks the token each time, this capability is also the verification fallback [Get Claims](auth.session.get_claims) uses for tokens it cannot verify locally.

## Related

- [Get Claims](auth.session.get_claims) - local verification without the round trip, falling back to this capability
