---
name: MFA WebAuthn List Authenticators
description: List all WebAuthn authenticators registered for the current user.
group: mfa-webauthn
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/user"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_listPasskeys]
---
