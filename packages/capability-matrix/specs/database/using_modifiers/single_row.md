# Expect Single Row

Enables query execution where the end result is one of two states:

| Query Match                     | Result             |
| ------------------------------- | ------------------ |
| Exactly one row.                | Success with Row   |
| Zero rows or more than one row. | Failure with Error |

Where:

- **Row**: The single row result
- **Error**: A failure indication that the user can handle, as idiomatic for this SDK

This contrasts starkly with the behavior of [`maybe_single_row`](maybe_single_row.md) by:

- being more strict, with only the single success path for 'exactly one row' matches
- delegating cardinality enforcement to the PostgREST service as [`PGRST116`](https://docs.postgrest.org/en/latest/references/errors.html#pgrst116)
- sending the request with the 'Singular' HTTP `Accept` header (`application/vnd.pgrst.object+json` - see [Singular or Plural](https://docs.postgrest.org/en/latest/references/api/resource_representation.html#singular-plural))
