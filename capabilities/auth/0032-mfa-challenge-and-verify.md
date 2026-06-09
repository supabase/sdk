---
name: MFA Challenge and Verify
description: Create a challenge and verify a code in a single call for convenience.
group: mfa
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/factors/{factorId}/challenge"
    - method: POST
      path: "/factors/{factorId}/verify"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [challengeAndVerify]
---
