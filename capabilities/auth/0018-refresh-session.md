---
name: Refresh Session
description: Force an immediate refresh of the current session using the refresh token.
group: session
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [refreshSession]
---
