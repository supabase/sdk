---
name: Update User
description: Update the current user's attributes such as email, password, or metadata.
group: session
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: PUT
      path: "/user"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [updateUser]
---
