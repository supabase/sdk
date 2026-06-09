---
name: MFA WebAuthn Start Registration
description: Begin WebAuthn authenticator registration by generating credential creation options.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_startPasskeyRegistration]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors` — `factor_type=webauthn`
