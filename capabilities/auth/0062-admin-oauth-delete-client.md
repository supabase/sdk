---
name: Admin OAuth Delete Client
description: Remove a registered OAuth client from the project.
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_deleteOAuthClient]
---
