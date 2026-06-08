---
name: Register Passkey
description: Register a new WebAuthn passkey for the currently authenticated user.
group: passkey
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [registerPasskey]
---
