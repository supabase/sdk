# MFA Get Authenticator Assurance Level

Report the session's current and next authenticator assurance level (AAL), and the methods used to sign in.

## Behavior

The SDK decodes the current access token locally, without verifying its signature, and reads two claims:

- `aal` gives `currentLevel`, `aal1` or `aal2`. A token without `aal` yields no current level.
- `amr` gives `currentAuthenticationMethods`, a list of `{method, timestamp}` entries. An entry may also be a bare string, as a custom access token hook can emit; the SDK turns it into `{method: <string>, timestamp: <token's iat>}`. A token without `amr` yields an empty list.

`nextLevel` is `aal2` when the user has at least one verified factor, and otherwise equals `currentLevel`. Factors come from the user's `factors` array. SDKs that cache the user may read the cache or fetch `GET /user`; a fetch is accurate after enroll or unenroll, a cached read needs no network.

An application compares the two levels to decide whether to prompt for a second factor: `currentLevel` is `aal1` and `nextLevel` is `aal2`.

## Prerequisites

A stored session. When there is none, the SDK must signal the missing session, either as a session-missing error or as absent levels (no `currentLevel`, no `nextLevel`, an empty method list). It must not report a level.

## Errors

- A token that cannot be decoded as a JWT is an error; the SDK does not guess a level.

## Notes

- The signature is not checked, so the result is advisory for UI flow. Authorization decisions belong to the server.

## Related

- [MFA Verify](verify.md): raises the session to `aal2`
- [MFA List Factors](list_factors.md): the factor list behind `nextLevel`
- [Get Claims](../session/get_claims.md): verified access to the same token claims
