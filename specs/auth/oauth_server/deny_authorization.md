# OAuth Deny Authorization

Deny a pending OAuth authorization request, rejecting the consent step of Supabase acting as an OAuth server on behalf of the current (resource-owner) user.

## Behavior

Takes the identifier of a pending authorization request — obtained via [OAuth Get Authorization Details](auth.oauth_server.get_authorization_details) — and denies it on behalf of the currently authenticated user. No grant is created and the requesting OAuth client receives an error response rather than an authorization code.

Once denied, the same authorization request cannot be approved or denied again.

## Prerequisites

- The caller must have an active session — denial is performed as the resource owner, not the OAuth client.
- The authorization request must exist and be pending.

## Related

- [OAuth Get Authorization Details](auth.oauth_server.get_authorization_details) — fetch the pending request before deciding
- [OAuth Approve Authorization](auth.oauth_server.approve_authorization) — the acceptance counterpart
