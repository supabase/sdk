---
name: Admin OAuth Get Client
description: Retrieve details of a specific OAuth client by its client ID.
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/admin/oauth/clients/{client_id}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_getOAuthClient]
---
