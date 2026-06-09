---
name: Sign In with SSO
description: Sign in via SAML SSO by supplying a domain or provider ID.
group: sign-in
openapi:
  repo: supabase/auth
  path: openapi.yaml
  operations:
    - method: POST
      path: "/sso"
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [signInWithSSO]
---
