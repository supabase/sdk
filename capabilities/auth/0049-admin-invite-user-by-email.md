---
name: Admin Invite User by Email
description: Send an invite email to a new user (requires service role).
group: admin
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueAdminApi.ts
        symbols: [inviteUserByEmail]
---
