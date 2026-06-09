---
name: Unlink Identity
description: Remove a linked identity from the current user's account.
group: identities
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: DELETE
      path: "/user/identities/{identityId}"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [unlinkIdentity]
---
