---
name: MFA List Factors
description: List all MFA factors enrolled for the current user.
group: mfa
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
        symbols: [listFactors]
---
