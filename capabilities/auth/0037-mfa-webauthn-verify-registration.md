---
name: MFA WebAuthn Verify Registration
description: Complete WebAuthn authenticator registration by verifying the credential response.
group: mfa-webauthn
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [_verifyPasskeyRegistration]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors/{factorId}/verify`
