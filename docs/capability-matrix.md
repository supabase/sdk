# Capability Matrix

The capability matrix is the canonical feature registry for all Supabase client SDKs. It defines what features exist (ID, name, description, grouping) across the supported client SDKs, and each SDK repo declares which features it implements via its own `sdk-compliance.yaml` file.

## Feature IDs

Feature IDs use three segments: `{area}.{group}.{method}` (e.g., `auth.sign_in.email`, `storage.buckets.create`). IDs are defined in this repo's `capabilities/*.yaml` files and must be globally unique.

## SDK Compliance Format

Each SDK repo hosts a `sdk-compliance.yaml` at a known path:

```yaml
sdk: javascript
features:
  auth.sign_in.email: implemented
  auth.mfa.enroll:
    status: partially_implemented
    note: "TOTP only"
    symbols:
      - GoTrueClient.mfaEnroll
  storage.objects.upload: not_implemented
```

Valid status values: `implemented`, `partially_implemented`, `not_implemented`, `not_applicable`.

The optional `symbols` field lists the public API symbol(s) that implement a feature. CI uses it two ways:

- **New-symbol check** (blocking): a PR that adds a new public symbol not listed under any feature's `symbols` fails, prompting the author to register it.
- **Drift check** (non-blocking warning): every feature marked `implemented` with a `symbols` list is periodically re-verified against the SDK's actual public API. If a registered symbol can no longer be found (renamed, removed) — or if an `implemented` feature has no `symbols` registered at all to verify against — CI posts a warning so the entry can be corrected.
