---
name: OAuth Get Authorization Details
description: Fetch the details of a pending OAuth authorization request (for consent screens).
group: oauth-server
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/oauth/authorizations/{authorization_id}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_getAuthorizationDetails]
---
