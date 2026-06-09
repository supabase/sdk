---
name: Sign Up
description: Register a new user with email or phone and password.
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/signup"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signUp]
---

## Behavior

Accepts `credentials` — either an `email`+`password` pair or a `phone`+`password` pair — and an
optional `options` object. Creates a new user account in the project and returns the new `User`
alongside a `Session`.

`signUp(credentials: { email, password } | { phone, password }, options?) → { user, session }`

If the project has email or phone confirmation enabled, the returned `Session` is `null` until the
user confirms their address; the `User` is always returned immediately.

## Prerequisites

The client must not already have an active session. Calling this while signed in creates a second
account rather than associating the credentials with the current user.

## Errors

- `email_exists` — a user with this email already exists in the project
- `weak_password` — the password does not satisfy the project's configured strength policy
- `signup_disabled` — user sign-ups are disabled for this project

## Notes

When email confirmation is required, the session is `null` on return. The caller should prompt the
user to check their inbox and use `auth.verify_otp` or `auth.resend` as the next step.

## Related

- [Verify OTP](auth.verify_otp) — required next step when sign-up triggers a confirmation flow
- [Resend Confirmation](auth.resend) — resend the confirmation email if the user did not receive it
- [Sign In with Password](auth.sign_in_with_password) — authenticate an already-registered account
