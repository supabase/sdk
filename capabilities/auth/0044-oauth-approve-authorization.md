---
name: OAuth Approve Authorization
description: Approve a pending OAuth authorization request on behalf of the current user.
group: oauth-server
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_approveAuthorization]
---
