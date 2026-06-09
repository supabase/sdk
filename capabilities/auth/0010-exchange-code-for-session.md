---
name: Exchange Code for Session
description: Exchange a PKCE authorization code for a user session.
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/token"
      params:
        grant_type: pkce
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [exchangeCodeForSession]
---
