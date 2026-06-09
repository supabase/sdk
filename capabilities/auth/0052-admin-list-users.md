---
name: Admin List Users
description: Retrieve a paginated list of all users in the project.
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/admin/users"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [listUsers]
---
