---
name: MFA Verify
description: Verify a code against an active MFA challenge to complete second-factor authentication.
group: mfa
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [verify]
---
