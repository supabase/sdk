---
name: Sign In with ID Token
description: Authenticate using a provider-issued ID token (e.g. from Apple or Google).
group: sign-in
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signInWithIdToken]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /token` — `grant_type=id_token`
