---
name: OAuth Get Authorization Details
description: Fetch the details of a pending OAuth authorization request (for consent screens).
group: oauth-server
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_getAuthorizationDetails]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /oauth/authorizations/{authorization_id}`
