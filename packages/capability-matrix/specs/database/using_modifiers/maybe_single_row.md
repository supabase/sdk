# Expect At Most One Row

Enables query execution where the end result is one of three states:

| Query Match        | Result               |
| ------------------ | -------------------- |
| No rows.           | Success with Nothing |
| Exactly one row.   | Success with Row     |
| More than one row. | Failure with Error   |

Where:

- **Nothing**: Idiomatic result for this SDK (e.g. `null`, `nil`, zero-value, etc.)
- **Row**: The single row result
- **Error**: A failure indication that the user can handle, as idiomatic for this SDK

This contrasts starkly with the behavior of [`single_row`](single_row.md) by:

- being less strict, supporting success paths for both 'no rows' and 'exactly one row' matches
- handling cardinality enforcement on the client-side (never surfacing [`PGRST116`](https://docs.postgrest.org/en/latest/references/errors.html#pgrst116))
- sending the request with default HTTP `Accept` header (e.g. `application/json`, _not_ `application/vnd.pgrst.object+json` - see [Singular or Plural](https://docs.postgrest.org/en/latest/references/api/resource_representation.html#singular-plural))
