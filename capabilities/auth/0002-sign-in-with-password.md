---
name: Sign In with Password
description: Authenticate an existing user with email or phone and password.
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/token"
      params:
        grant_type: password
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signInWithPassword]
---
