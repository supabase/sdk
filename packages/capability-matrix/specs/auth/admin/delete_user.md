# Admin Delete User

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `DELETE /admin/users/{userId}`

The OpenAPI entry documents no request body and documents the deleted user as the 200 response body. The handler, [`adminUserDelete`](https://github.com/supabase/auth/blob/master/internal/api/admin.go), reads `should_soft_delete` from the body and answers with an empty JSON object.

<!-- Delete the paragraph above once supabase/auth#2859 corrects the entry:
     https://github.com/supabase/auth/issues/2859 -->

## Behavior

The call deletes the user outright unless the caller asks for a soft delete, which keeps the user row with `deleted_at` set and the account disabled. The choice is made per call, not per client, and the default is the hard delete. What a delete does to the user's other data, what blocks it, and why a signed-in user's token outlives it are the service's behavior, documented in [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users), not here.

The success response body is an empty JSON object in both modes, so SDKs return success and nothing else. An SDK should not type the result as the deleted user, because the server does not send one. A caller who wants a record of what was deleted reads the user before this call.

## Errors

- A user id that is not a UUID is rejected before any request is sent, as the SDK's own argument error and never as the server error type. The server's answer to such an id is HTTP 404 with error code `validation_failed` and the message `user_id must be an UUID` ([`loadUser`](https://github.com/supabase/auth/blob/master/internal/api/admin.go)), the same status an unknown user gets with `user_not_found`, so code that branches on the status would read a typo as a missing user. SDKs accept at least the canonical hyphenated form, 32 hexadecimal digits in groups of 8, 4, 4, 4, and 12, in either case, which is the form the server issues ids in. The server also accepts the braced, bare hexadecimal, and URN forms, and an SDK may accept those too.

## Related

- [Get Claims](../session/get_claims.md): local verification does not see a deletion until the token expires
- Admin Get User (`auth.admin.get_user`): reads a soft-deleted user, with its `deleted_at`, and is the read to make before a hard delete when a record of the user is wanted
- Admin Sign Out (`auth.admin.sign_out`): revokes sessions without deleting the user
