---
name: MFA WebAuthn Update Authenticator
description: Update metadata (e.g. friendly name) on a registered WebAuthn authenticator.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_updatePasskey]
---
