---
name: Verify OTP
description: Verify a one-time password or token hash to complete sign-in or email confirmation.
group: sign-in
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [verifyOtp]
---
