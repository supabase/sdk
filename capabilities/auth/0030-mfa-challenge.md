---
name: MFA Challenge
description: Create a challenge for an enrolled MFA factor to begin the verification flow.
group: mfa
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/factors/{factorId}/challenge"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [challenge]
---
