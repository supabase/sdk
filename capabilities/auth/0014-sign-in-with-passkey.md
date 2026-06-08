---
name: Sign In with Passkey
description: Authenticate using a WebAuthn passkey registered on the device.
group: passkey
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signInWithPasskey]
---
