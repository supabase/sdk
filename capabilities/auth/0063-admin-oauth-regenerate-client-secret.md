---
name: Admin OAuth Regenerate Client Secret
description: Regenerate the client secret for a registered OAuth application.
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [_regenerateOAuthClientSecret]
---

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /admin/oauth/clients/{client_id}/regenerate_secret`
