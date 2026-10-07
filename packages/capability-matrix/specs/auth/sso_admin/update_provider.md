# Admin Update SSO Provider

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `PUT /admin/sso/providers/{ssoProviderId}`

The OpenAPI entry lags the handler, [`adminSSOProvidersUpdate`](https://github.com/supabase/auth/blob/master/internal/api/ssoadmin.go), in its request fields and path addressing, in the same ways as [Admin Create SSO Provider](create_provider.md), until it is corrected.

## Behavior

The server applies a partial update, and two of its rules shape how an SDK models the request:

- `domains` and `attribute_mapping` distinguish absent from empty. Leaving either out keeps the stored value, as the API spec says, while an empty `domains` array removes every domain and an `attribute_mapping` with an empty `keys` object clears the mapping. An SDK that serializes either field whenever the caller did not set it wipes the stored value, so the SDK's update type has to carry "not set" separately from "empty".
- `name_id_format` works the other way around: leaving it out clears a stored format. To keep it, send the current value, which means reading the provider before writing it.

As with create, a `metadata_url` is fetched server-side before the call returns.

## Related

- [Admin Create SSO Provider](create_provider.md): addressing, and the API spec's gaps
