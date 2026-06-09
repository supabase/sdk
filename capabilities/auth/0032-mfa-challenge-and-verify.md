---
name: MFA Challenge and Verify
description: Create a challenge and verify a code in a single call for convenience.
group: mfa
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [challengeAndVerify]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors/{factorId}/challenge`
- `POST /factors/{factorId}/verify`
