---
name: MFA WebAuthn Verify Registration
description: Complete WebAuthn authenticator registration by verifying the credential response.
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
        symbols: [_verifyPasskeyRegistration]
---
