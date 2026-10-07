# Admin List SSO Providers

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /admin/sso/providers`

The OpenAPI entry documents no query parameters. The handler, [`adminSSOProvidersList`](https://github.com/supabase/auth/blob/master/internal/api/ssoadmin.go), reads `resource_id` and `resource_id_prefix` filters, until the entry is corrected.

## Behavior

The response schema shows `metadata_xml` on each provider, but the list omits it. An SDK that models the provider with a required metadata field sees it missing here and present from Admin Get SSO Provider, so make the field optional or document the difference.

## Related

- Admin Get SSO Provider (`auth.sso_admin.get_provider`): one provider, with its metadata
- [Admin Create SSO Provider](create_provider.md): where `resource_id` is set
