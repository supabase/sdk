# OAuth Approve Authorization

Approve a pending OAuth authorization request, completing the consent step of Supabase acting as an OAuth server on behalf of the current (resource-owner) user.

## Behavior

Takes the identifier of a pending authorization request — obtained via [OAuth Get Authorization Details](auth.oauth_server.get_authorization_details) — and approves it on behalf of the currently authenticated user. Approval results in the requesting OAuth client receiving whatever grant artifact its flow specifies (e.g. an authorization code delivered via redirect), and creates a durable grant record the user can later review or revoke.

Once approved, the same authorization request cannot be approved or denied again.

## Prerequisites

- The caller must have an active session — approval is performed as the resource owner, not the OAuth client.
- The authorization request must exist and be pending; use [OAuth Get Authorization Details](auth.oauth_server.get_authorization_details) to fetch and display it (client name, requested scopes) before approving.

## Related

- [OAuth Get Authorization Details](auth.oauth_server.get_authorization_details) — fetch the pending request before deciding
- [OAuth Deny Authorization](auth.oauth_server.deny_authorization) — the rejection counterpart
- [OAuth List Grants](auth.oauth_server.list_grants) — view grants created by past approvals
- [OAuth Revoke Grant](auth.oauth_server.revoke_grant) — revoke a grant after the fact
