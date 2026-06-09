---
name: Sign In with ID Token
description: Authenticate using a provider-issued ID token (e.g. from Apple or Google).
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/token"
      params:
        grant_type: id_token
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signInWithIdToken]
---
