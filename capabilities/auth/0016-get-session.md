---
name: Get Session
description: Return the current active session, refreshing the access token if needed.
group: session
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/token"
      params:
        grant_type: refresh_token
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [getSession]
---
