---
name: Admin OAuth Regenerate Client Secret
description: Regenerate the client secret for a registered OAuth application.
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_regenerateOAuthClientSecret]
---
