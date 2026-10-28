# Sign Out

End the user's sessions on the Auth server for a chosen scope and, when the 
scope includes the current session, remove the locally stored session. 

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /logout?scope={global|local|others}`

## Behavior

The input is a scope, one of `global`, `local`, or `others`. 

When the caller supplies none, the SDK must define a default. The SDK always 
sends the `scope` query parameter, it must not rely on the server default.

The request is authenticated with the current session's access token as the 
bearer credential. When the stored access token has expired, the SDK refreshes
the session first, as it does before any authenticated call, so the server can
identify the session to end.

When there is no stored session, the SDK makes no request, removes any 
remaining local auth state as described below, and returns success.

The server answers `204 No Content`, so the SDK returns nothing beyond the
absence of an error. Errors defines the outcomes each scope below reacts to:
success, already signed out, failure, and a failed refresh.

Removing the local session clears all auth state the SDK persists for the user:
the stored session, every stored PKCE code verifier, and any separately stored
copy of the user object. It then emits the sign-out event through Subscribe to
Auth Events (`auth.session.subscribe_auth_events`), with the user-initiated
reason from [Sign-Out Reason](sign_out_reason.md). The SDK emits the
event exactly when it removes the local session.

Sign-out ends the refresh token, not the access token. An access token already
issued stays valid until its `exp` claim, so the SDK cannot make it unusable
elsewhere. It can only stop holding it.

SDKs that serialize session operations behind a lock run sign-out under that
lock, so a refresh in flight cannot write a new session back after sign-out has
removed it.

The table summarizes the three scopes, which the sections below describe in
full. Already signed out follows the success column.

| Scope    | Server sessions ended                     | Local session on success | Local session on failure | Error returned on failure |
| -------- | ----------------------------------------- | ------------------------ | ------------------------ | ------------------------- |
| `local`  | The current session                       | Removed                  | Removed                  | Yes                       |
| `global` | Every session of the user                 | Removed                  | Kept                     | Yes                       |
| `others` | Every session of the user except this one | Kept                     | Kept                     | Yes                       |

### `local`

Signs out this device and revokes the current session's refresh token on the
server. Signing out of the device never depends on the server.

The SDK removes the local session, and emits the sign-out event, before it
sends the request. The device is signed out whatever the server answers and
however long it takes to answer.

- **Success or already signed out:** the SDK returns success.
- **Failure:** the SDK returns the error. The device stays signed out, but the
  refresh token stays valid on the server until it expires or is revoked
  another way. The error lets the app tell that the revocation did not happen.
- **Refresh failed with a network failure or a `5xx`:** the SDK removes the
  local session anyway and returns the refresh error.

A sign-out event listener that throws does not stop the request: the SDK sends
it, then raises the listener's error in place of the result.

### `global`

Ends every session of the user on the server, including this one, then signs
out this device. The local session changes only after the server has answered
with success or already signed out.

- **Success or already signed out:** the SDK removes the local session and
  returns success.
- **Failure:** the SDK keeps the local session, emits no event, and returns the
  error.
- **Refresh failed with a network failure or a `5xx`:** the SDK keeps the local
  session and returns the refresh error.

Keeping the session on failure lets the user retry, or fall back to `local`.

Removing it would leave the client with no credentials with which to end the
other sessions.

### `others`

Ends every session of the user on the server except this one. The SDK never
changes the local session for this scope, and so never emits the sign-out
event.

- **Success or already signed out:** the SDK returns success.
- **Failure:** the SDK returns the error.
- **Refresh failed with a network failure or a `5xx`:** the SDK keeps the local
  session and returns the refresh error.

## Errors

- A check before hitting the wire: the scope must be exactly one of `global`, 
  `local`,  or `others`. Any other value should cause a failure.

The SDK classifies every logout response by its HTTP status and `error_code`
as one of three outcomes:

- **Success:** `204`.
- **Already signed out:** the server found nothing left to revoke for the
  scope. The SDK handles it exactly like a `204`.
- **Failure:** every other answer and every network failure. The SDK returns
  the error.

The server answers land in those outcomes as follows:

| Server answer                                    | `local`            | `global`           | `others`           |
| ------------------------------------------------ | ------------------ | ------------------ | ------------------ |
| `204`                                            | Success            | Success            | Success            |
| `403` `user_not_found`                           | Already signed out | Already signed out | Already signed out |
| `403` `session_not_found`                        | Already signed out | Failure            | Failure            |
| `403` `bad_jwt`, `403` `user_banned`             | Failure            | Failure            | Failure            |
| `400` `bad_jwt`, `401` `no_authorization`, `404` | Failure            | Failure            | Failure            |
| Any other `4xx` or `5xx`, or a network failure   | Failure            | Failure            | Failure            |

The reason for each row:

- `403` `user_not_found`: the user no longer exists, and neither do its
  sessions, so nothing is left to revoke for any scope.
- `403` `session_not_found`: the current session no longer exists, so nothing
  is left to revoke for `local`, but the other sessions that `global` and
  `others` end still do. The stored session is then unusable, so
  an app that gets this failure for `global` falls back to `local` to sign out
  the device.
- `403` `bad_jwt` (the access token is expired, its signature cannot be
  verified, or a claim is missing or malformed) and `403` `user_banned`:
  the server rejected the token before looking at any session, so
  every session still exists. A ban does not end sessions.
- `400` `bad_jwt`: the `sub` claim is not a UUID.
- `401` `no_authorization`: the request carried no bearer token.
- `404`: the Auth server never answers it on this endpoint, so it
  comes from something in front of the server.
- Any other `4xx` or `5xx`, including the `500` the server answers when it
  cannot end the sessions: the SDK returns the server's error.
- A network failure: the SDK returns its retryable network error, so
  the app can tell an unreachable server from a refusal and retry.

When the refresh before the request fails, the SDK sends no logout request and
returns the refresh error. A refresh the server rejected with a `4xx` has
already removed the local session. A refresh that failed with a network failure
or a `5xx` leaves the stored session in place, and each scope under Behavior
says what happens to it.

## Notes

- Auth servers before v2.145.0 send no `error_code` on this endpoint. They
  answer `401` for any token they cannot accept and `404` for a missing user,
  and do not check the session, so a missing session gets `204`. This spec
  does not support them: against such a server every `401` and `404` is a
  failure, including the `404` that means the user is already gone.
- Each SDK can define their own default scope, Auth uses `global`, so 
  default to this unless there is a good reason to do otherwise.
- SDKs that hold no session (stateless server-side SDKs) implement this 
  capability as the admin form, Admin Sign Out (`auth.admin.sign_out`), which 
  takes the access token explicitly and keeps no local state to clear.

## Related

- [Sign-Out Reason](sign_out_reason.md): the reason carried on the sign-out event this 
  capability emits.
- Subscribe to Auth Events (`auth.session.subscribe_auth_events`): the event 
  stream the sign-out event is emitted on.
- Admin Sign Out (`auth.admin.sign_out`): the same server call with an 
  explicitly supplied access token.
- Refresh Session (`auth.session.refresh_session`): runs before sign-out when
  the stored access token has expired.
