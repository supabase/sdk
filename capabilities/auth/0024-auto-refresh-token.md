---
name: Auto Refresh Token
description: SDK automatically refreshes the access token in the background before it expires; exposes hooks to start and stop the refresh loop.
group: session
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [startAutoRefresh, stopAutoRefresh]
---
