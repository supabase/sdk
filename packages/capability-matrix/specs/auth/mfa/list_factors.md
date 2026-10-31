# MFA List Factors

List the current user's MFA factors, split by verification state.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /user`

The factors come from the `factors` array of the user resource. The server returns factors of type `recovery_code`, although the API spec omits that type.

## Behavior

The SDK sends a fresh `GET /user` with the current session's access token. It does not read the user cached in the stored session, because the cache goes stale after enroll, verify, and unenroll. The call does not update the stored session.

The SDK returns the factors in two groups, `verified` and `unverified`, by each factor's `status`. It may also group verified factors by type. Order within a group is the server's order. An empty `factors` array or a missing one yields two empty groups.

Factor types include `totp`, `phone`, `webauthn`, and `recovery_code`. SDKs must tolerate a type they do not know: the factor stays in its status group and is never dropped or raised as a decoding error.

## Prerequisites

An active session. Without one the SDK signals a missing session and sends no request.

## Errors

- A non-2xx answer from `GET /user` (for example `bad_jwt` or `session_not_found`) is returned as the server error.

## Related

- [Get User](../session/get_user.md): the call this capability reads from
- [MFA Enroll](enroll.md): creates unverified factors
- [MFA Unenroll](unenroll.md): removes a factor by id
- [MFA Get Authenticator Assurance Level](get_authenticator_assurance_level.md): uses verified factors to compute `nextLevel`
