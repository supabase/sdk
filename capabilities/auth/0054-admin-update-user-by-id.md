---
name: Admin Update User by ID
description: Update a user's attributes (email, password, metadata, role, etc.) by their UUID.
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: PUT
      path: "/admin/users/{userId}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [updateUserById]
---
