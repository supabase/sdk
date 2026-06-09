---
name: Admin Delete User
description: Permanently delete a user by their UUID (hard or soft delete).
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: DELETE
      path: "/admin/users/{userId}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [deleteUser]
---
