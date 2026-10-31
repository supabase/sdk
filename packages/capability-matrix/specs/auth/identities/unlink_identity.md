# Unlink Identity

Remove one linked identity from the signed-in user.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `DELETE /user/identities/{identity_id}`

The OpenAPI entry describes the 200 body as the user's account data. The handler, [`DeleteIdentity`](https://github.com/supabase/auth/blob/master/internal/api/identity.go), answers with an empty JSON object.

<!-- Delete the paragraph above once supabase/auth#<issue> corrects the entry:
     <issue URL> -->

## Behavior

The input is an identity, as [List Identities](list_identities.md) returns it, or its `identity_id`. The path segment is the identity's `identity_id`, the UUID of the identity row. It is never the identity's `id`, which is the provider's subject. A subject that is not a UUID gets 404 `validation_failed`. A subject that happens to be a UUID gets 422 `identity_not_found`.

The request carries the current session's access token as its bearer credential. SDKs that hold a session use the stored session's token. Stateless server-side SDKs take the access token as an explicit input.

The success body is an empty JSON object, so the SDK returns success and nothing else. The response carries no user, so the SDK does not change the stored session and emits no event. The stored user still lists the removed identity. A caller that needs the current list calls [List Identities](list_identities.md).

The SDK does not check the identity count before the wire. The stored user can be stale, and the server's 422 `single_identity_not_deletable` is the answer of record.

## Prerequisites

The project must have manual linking turned on. When it is off, the server answers 404 `manual_linking_disabled`. See [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Errors

- No session: SDKs that hold a session raise their session-missing error and send no request.
- An `identity_id` that is not a UUID is rejected before any request is sent, as the SDK's own argument error and never as the server error type. The server's answer to such an id is HTTP 404 with error code `validation_failed` and the message `identity_id must be an UUID`. That is the same status `manual_linking_disabled` gets, so code that branches on the status would read a bad id as a project setting. SDKs accept at least the canonical hyphenated form, 32 hexadecimal digits in groups of 8, 4, 4, 4, and 12, in either case.
- An SDK whose identity type holds `identity_id` as a decoded UUID needs no check here, because [List Identities](list_identities.md) already fails the decode of an identity without one.
- `single_identity_not_deletable`, `identity_not_found`, and `email_conflict_identity_not_deletable` (all 422): passed through as the server error type with their `error_code`. The SDK does not retry them. None of them clears the stored session.

## Notes

- The access token keeps the claims it had at issue, including `app_metadata.providers`, which still names the removed provider until the next refresh.

## Related

- [List Identities](list_identities.md): gives the `identity_id` this call needs
- [Link Identity](link_identity.md): the reverse operation
