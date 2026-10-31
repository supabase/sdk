# List Identities

Return the identities linked to the signed-in user.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /user`

There is no identities endpoint. The list is the `identities` field of the user resource.

The OpenAPI `IdentitySchema` types `id` as a UUID. The [`Identity`](https://github.com/supabase/auth/blob/master/internal/models/identity.go) model sends `id` as the provider's subject, a free-form string such as a numeric GitHub user id.

<!-- Delete the paragraph above once supabase/auth#<issue> corrects the entry:
     <issue URL> -->

## Behavior

The SDK calls [Get User](../session/get_user.md) and returns its `identities`. It does not read the user stored in the session. That copy is stale after a link or unlink, because [Unlink Identity](unlink_identity.md) returns no user and an OAuth link finishes in a later callback.

The server sends `identities` as an array, which can be `[]`, or as `null`. The SDK returns an empty list for `[]` and `null`, and also when the field is absent.

Each identity carries two ids. The SDK decodes them as two separate fields and never merges them:

- `identity_id` is the UUID of the identity row. It is the id that [Unlink Identity](unlink_identity.md) puts in its path. The SDK decodes it as a UUID.
- `id` is the provider's subject for the user. The SDK decodes it as a string and never parses it as a UUID.

## Errors

- An identity without `identity_id`, or with an `identity_id` that is not a UUID, fails the decode with the SDK's decoding error. The SDK never fills in a zero UUID, an empty string, or the value of `id`. A filled-in value sends a later unlink to the wrong path, and the server answers 404 `validation_failed` or 422 `identity_not_found` instead of a decode error at the point of failure.
- Errors from Get User pass through, such as `bad_jwt` and `session_not_found`.

## Related

- [Get User](../session/get_user.md): the call this capability makes
- [Link Identity](link_identity.md): adds an identity to this list
- [Unlink Identity](unlink_identity.md): removes an identity from this list, by `identity_id`
