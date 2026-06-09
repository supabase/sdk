---
name: OAuth Deny Authorization
description: Deny a pending OAuth authorization request on behalf of the current user.
group: oauth-server
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/oauth/authorizations/{authorization_id}/consent"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_denyAuthorization]
---
