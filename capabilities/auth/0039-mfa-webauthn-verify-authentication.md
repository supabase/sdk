---
name: MFA WebAuthn Verify Authentication
description: Complete WebAuthn authentication by verifying the assertion response.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_verifyPasskeyAuthentication]
---
