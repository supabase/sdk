---
name: Admin Generate Link
description: Generate an email action link (confirmation, magic link, recovery) for a user.
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [generateLink]
---
