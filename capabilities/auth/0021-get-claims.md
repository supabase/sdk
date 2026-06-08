---
name: Get Claims
description: Verify and return the JWT claims for the current session using asymmetric keys.
group: session
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [getClaims]
---
