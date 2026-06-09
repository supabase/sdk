---
name: MFA Enroll
description: Enroll a new MFA factor (TOTP or phone) for the current user.
group: mfa
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/factors"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [enroll]
---
