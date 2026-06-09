---
name: MFA Unenroll
description: Remove an enrolled MFA factor from the current user's account.
group: mfa
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: DELETE
      path: "/factors/{factorId}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [unenroll]
---
