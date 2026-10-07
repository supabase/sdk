# Admin Create SSO Provider

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /admin/sso/providers`

The OpenAPI entry lags the handler, [`adminSSOProvidersCreate`](https://github.com/supabase/auth/blob/master/internal/api/ssoadmin.go), in its response code, request fields, and response field names, until it is corrected ([supabase/auth#2859](https://github.com/supabase/auth/issues/2859)).

## Behavior

The server answers with 201 where the API spec says 200. SDKs should treat any 2xx as success.

A provider registered with a `resource_id` can be addressed as `resource_<resource_id>` in place of its UUID in the get, update, and delete paths. SDKs should therefore not validate provider ids as UUIDs, unlike user and factor ids.

When the request gives `metadata_url`, the server fetches and parses the identity provider's metadata before answering, so the call takes as long as that outbound request. SDK timeouts should allow for it, as they do for custom OIDC provider creation, which fetches the discovery document the same way.

## Prerequisites

None beyond admin credentials. SAML sign-in does not need to be turned on for the project to manage providers, only to sign in through them, so server-side tooling and integration tests can register providers on a stack with no SAML configuration.

## Related

- [Admin Update SSO Provider](update_provider.md): the partial-update rules an SDK has to preserve
- [Admin List SSO Providers](list_providers.md): what the list leaves out
- Sign In with SSO (`auth.sign_in.sign_in_with_sso`): the user-side flow these providers serve
