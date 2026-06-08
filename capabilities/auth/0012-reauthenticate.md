---
name: Reauthenticate
description: Send a reauthentication nonce to verify the user before sensitive operations such as password change.
group: sign-in
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [reauthenticate]
---
