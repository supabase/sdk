---
name: MFA Enroll
description: Enroll a new MFA factor (TOTP or phone) for the current user.
group: mfa
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [enroll]
---
