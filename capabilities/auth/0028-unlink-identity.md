---
name: Unlink Identity
description: Remove a linked identity from the current user's account.
group: identities
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [unlinkIdentity]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `DELETE /user/identities/{identityId}`
