---
name: Admin MFA List Factors
description: List all MFA factors enrolled for a specific user (requires service role).
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/admin/users/{userId}/factors"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [listFactors]
---
