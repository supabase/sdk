---
name: Get User
description: Fetch the authenticated user's profile from the server, verifying the JWT.
group: session
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [getUser]
---
