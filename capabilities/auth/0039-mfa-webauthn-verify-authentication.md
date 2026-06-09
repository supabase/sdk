---
name: MFA WebAuthn Verify Authentication
description: Complete WebAuthn authentication by verifying the assertion response.
group: mfa-webauthn
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/factors/{factorId}/verify"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_verifyPasskeyAuthentication]
---
