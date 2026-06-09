---
name: Register Passkey
description: Register a new WebAuthn passkey for the currently authenticated user.
group: passkey
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/factors"
      params:
        factor_type: webauthn
    - method: POST
      path: "/factors/{factorId}/verify"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [registerPasskey]
---
