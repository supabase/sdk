# Admin Update MFA Factor

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `PUT /admin/users/{userId}/factors/{factorId}`

The OpenAPI entry documents the request body as an object with no properties. The accepted fields are in the handler, [`adminUserUpdateFactor`](https://github.com/supabase/auth/blob/master/internal/api/admin.go), until the entry is corrected.

## Behavior

There is no user-side counterpart, so this admin call is the only way a factor's friendly name changes after enrollment. SDKs should not add an update to the user-side MFA namespace.

The server treats the body as a partial update and answers an empty body with success and an unchanged factor. It also ignores the phone number on any factor that is not a phone factor, again with a success response. An SDK that wants either case to fail has to check for it before sending.

The server answers a malformed path id with 404 rather than 400. The existing SDKs validate both ids as UUIDs before sending, which turns that into a clear client-side error.

## Related

- Admin List MFA Factors (`auth.admin.list_mfa_factors`) and Admin Delete MFA Factor (`auth.admin.delete_mfa_factor`): the same path, credential, and id checks
- [MFA Enroll](../mfa/enroll.md): creates the factor from the user's side
