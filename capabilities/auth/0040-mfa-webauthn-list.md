---
name: MFA WebAuthn List Authenticators
description: List all WebAuthn authenticators registered for the current user.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_listPasskeys]
---
