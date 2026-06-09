---
name: Auto Refresh Token
description: SDK automatically refreshes the access token in the background before it expires; exposes hooks to start and stop the refresh loop.
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
        symbols: [startAutoRefresh, stopAutoRefresh]
---
