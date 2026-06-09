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

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors` — `factor_type=webauthn`
- `POST /factors/{factorId}/verify`
