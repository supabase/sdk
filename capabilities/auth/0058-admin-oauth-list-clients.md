---
name: Admin OAuth List Clients
description: List all registered OAuth clients for the project (requires service role).
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_listOAuthClients]
---
