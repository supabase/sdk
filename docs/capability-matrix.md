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

### Registering symbols

CI asks two different questions about an SDK's public API, and each one reads a different field.

- **Is this capability really implemented?** The **drift check** (non-blocking warning) re-verifies every feature marked `implemented` against the SDK's actual public API. If a registered symbol can no longer be found (renamed, removed), or if an `implemented` feature has no symbols registered at all to verify against, CI posts a warning so the entry can be corrected. This reads `symbols`.
- **Is every public symbol accounted for?** The **new-symbol check** (blocking) fails a PR that adds a public symbol the compliance file does not mention anywhere, prompting the author to register it. This reads `symbols` and `supporting_symbols` alike.

`symbols` is therefore for **entry points**: the methods a user calls to exercise the capability. Keep the list short and precise, because every name in it is a claim that the feature exists.

`supporting_symbols` is for the rest of the public surface that hangs off those entry points: option types, result types, schema models, exceptions. These need to be accounted for so the new-symbol check stays meaningful, but they do not evidence a capability and are never drift-verified.

```yaml
storage.analytics.create_table:
  status: implemented
  symbols:
    - IcebergRestCatalog.createTable
  supporting_symbols:
    - CreateTableRequest
    - CreateTableRequest.schema
```

Types shared across several features can be listed once in a top-level `supporting_symbols` list instead of being attributed to whichever feature happens to use them:

```yaml
sdk: flutter
features: {}
supporting_symbols:
  - IcebergException
  - TableMetadata
```

Do not pad `symbols` with supporting types to satisfy the new-symbol check, and do not repeat one shared list across several features to give each of them something to point at. Both inflate what the matrix claims is implemented, make drift warnings fan out across features that do not own the symbol, and leave the symbol-to-feature attribution arbitrary.
