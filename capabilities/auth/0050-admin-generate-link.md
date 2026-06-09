---
name: Admin Generate Link
description: Generate an email action link (confirmation, magic link, recovery) for a user.
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/admin/generate_link"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [generateLink]
---
