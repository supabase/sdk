---
name: Admin Get User by ID
description: Fetch a single user's profile and metadata by their UUID.
group: admin
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/admin/users/{userId}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [getUserById]
---
