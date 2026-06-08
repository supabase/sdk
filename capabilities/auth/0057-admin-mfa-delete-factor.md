---
name: Admin MFA Delete Factor
description: Delete a specific MFA factor from a user's account (requires service role).
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [deleteFactor]
---
