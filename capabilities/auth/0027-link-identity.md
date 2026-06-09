---
name: Link Identity
description: Link an additional OAuth or ID-token identity to the current user's account.
group: identities
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: GET
      path: "/user/identities/authorize"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [linkIdentity]
---
