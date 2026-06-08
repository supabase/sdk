---
name: OAuth Revoke Grant
description: Revoke a specific OAuth grant that the current user previously approved.
group: oauth-server
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_revokeOAuthGrant]
---
