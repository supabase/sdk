---
name: MFA Get Authenticator Assurance Level
description: Return the current and next authenticator assurance levels (AAL1/AAL2) for the session.
group: mfa
sdks:
  javascript:
    status: implemented
    references:
      - repo: supabase/supabase-js
        path: packages/core/auth-js/src/GoTrueClient.ts
        symbols: [getAuthenticatorAssuranceLevel]
---
