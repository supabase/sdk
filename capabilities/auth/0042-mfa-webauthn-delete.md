---
name: MFA WebAuthn Delete Authenticator
description: Remove a registered WebAuthn authenticator from the current user's account.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_deletePasskey]
---
