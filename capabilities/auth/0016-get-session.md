---
name: Get Session
description: Return the current active session, refreshing the access token if needed.
group: session
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [getSession]
---
