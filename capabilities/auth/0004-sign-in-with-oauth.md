---
name: Sign In with OAuth
description: Initiate a third-party OAuth sign-in flow (Google, GitHub, etc.).
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/authorize"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signInWithOAuth]
---
