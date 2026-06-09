---
name: OAuth List Grants
description: List all active OAuth grants the current user has approved.
group: oauth-server
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/user/oauth/grants"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_listOAuthGrants]
---
