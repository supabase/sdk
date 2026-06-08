---
name: MFA WebAuthn Start Authentication
description: Begin WebAuthn authentication by generating assertion options for an enrolled authenticator.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_startPasskeyAuthentication]
---
