# MFA Unenroll

Remove a factor from the current user's account, verified or not.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `DELETE /factors/{factor_id}`

## Behavior

The SDK sends the current session's access token as the bearer credential. A 2xx response body is `{"id": "<factor id>"}`. The SDK decodes it, so a malformed success is caught. It may return the id or nothing, because the caller already has the id.

Removing an unverified factor needs only a session. Removing a verified factor needs an AAL2 session. At AAL1 the server answers 422 `insufficient_aal`. The SDK surfaces it as a server error and does not try to upgrade the session; the application runs [challenge](challenge.md) and [verify](verify.md) first, then retries.

The SDK does not change the stored session.

A 2xx body that cannot be decoded is a decoding error, never reported as a server error.

## Prerequisites

An active session. For a verified factor, an AAL2 session.

## Errors

- `insufficient_aal`: a verified factor was removed from an AAL1 session. Not retried.
- `mfa_factor_not_found`: the id does not exist or belongs to another user.

## Related

- [MFA Enroll](enroll.md): creates a factor
- [MFA List Factors](list_factors.md): finds factor ids
- Admin Delete MFA Factor (`auth.admin.delete_mfa_factor`): removes a factor on another user's account
