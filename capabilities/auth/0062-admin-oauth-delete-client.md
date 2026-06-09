---
name: Admin OAuth Delete Client
description: Remove a registered OAuth client from the project.
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: DELETE
      path: "/admin/oauth/clients/{client_id}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_deleteOAuthClient]
---
