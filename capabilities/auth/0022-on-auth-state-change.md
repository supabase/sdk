---
name: On Auth State Change
description: Subscribe to authentication state change events (sign-in, sign-out, token refresh, etc.).
group: session
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [onAuthStateChange]
---
