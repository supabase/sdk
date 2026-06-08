---
name: Admin Create User
description: Create a new user with specified attributes without sending a confirmation email.
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [createUser]
---
