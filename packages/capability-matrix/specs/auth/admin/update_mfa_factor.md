# Admin Update MFA Factor

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `PUT /admin/users/{userId}/factors/{factorId}`

The OpenAPI entry documents the request body as an object with no properties. The accepted fields are in the handler, [`adminUserUpdateFactor`](https://github.com/supabase/auth/blob/master/internal/api/admin.go).

<!-- Delete the paragraph above once supabase/auth#2859 corrects the entry:
     https://github.com/supabase/auth/issues/2859 -->

## Behavior

There is no user-side counterpart, so this admin call is the only way a factor's friendly name changes after enrollment. SDKs should not add an update to the user-side MFA namespace.

The server treats the body as a partial update and answers an empty body with success and an unchanged factor. It also ignores the phone number on any factor that is not a phone factor, again with a success response. An SDK that wants either case to fail has to check for it before sending.

## Errors

- A user id or factor id that is not a UUID is rejected before any request is sent, as the SDK's own argument error and never as the server error type. The server's answer to such an id is HTTP 404 with error code `validation_failed` and the message `user_id must be an UUID` or `factor_id must be an UUID` ([`loadUser`](https://github.com/supabase/auth/blob/master/internal/api/admin.go) and [`loadFactor`](https://github.com/supabase/auth/blob/master/internal/api/admin.go)), the same status an unknown user or factor gets with `user_not_found` or `mfa_factor_not_found`, so code that branches on the status would read a typo as a missing record. SDKs accept at least the canonical hyphenated form, 32 hexadecimal digits in groups of 8, 4, 4, 4, and 12, in either case, which is the form the server issues ids in. The server also accepts the braced, bare hexadecimal, and URN forms, and an SDK may accept those too.

## Related

- Admin List MFA Factors (`auth.admin.list_mfa_factors`) and Admin Delete MFA Factor (`auth.admin.delete_mfa_factor`): the same path, credential, and id checks
- [MFA Enroll](../mfa/enroll.md): creates the factor from the user's side
