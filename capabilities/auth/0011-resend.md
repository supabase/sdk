---
name: Resend Confirmation
description: Resend a signup confirmation or OTP email/SMS to a user.
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/resend"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [resend]
---
