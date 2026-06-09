---
name: Admin OAuth Update Client
description: Update a registered OAuth client's settings (name, redirect URIs, etc.).
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: PUT
      path: "/admin/oauth/clients/{client_id}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_updateOAuthClient]
---
