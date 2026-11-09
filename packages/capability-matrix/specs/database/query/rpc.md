# Call Function (RPC)

Invoke a database function via the PostgREST RPC interface.

## API

Spec: [PostgREST Documentation: Functions as RPC](https://docs.postgrest.org/en/latest/references/api/functions.html)

- `POST /rpc/{function}` with the arguments as a JSON object body
- `GET /rpc/{function}` with each argument as a query parameter

## Behavior

A call is sent as `POST`, with the arguments as the JSON body, unless the caller asks for a read-only call on that call. The SDK never switches a call to `GET` on its own: not from the volatility the function declares, not from the shape of its arguments, and not to make the call retryable. Generated function calls (`database.generated_types.typed_rpc`) follow the same rule, whatever volatility the generated types record for the function.

The SDK leaves the method to the caller because a `GET` changes what the call observes and where its arguments travel:

- PostgREST runs a `GET` in a read-only transaction whatever the function's volatility ([Access Mode on Functions](https://docs.postgrest.org/en/latest/references/transactions.html#access-mode-on-functions)), so a `VOLATILE` function that writes answers HTTP 405 with code `25006` over `GET` and succeeds over `POST`.
- The Supabase API load balancer sends `GET` requests to read replicas ([Read Replicas](https://supabase.com/docs/guides/platform/read-replicas)), so a `GET` sent right after a write can read a replica that has not applied the write yet.
- The arguments of a `GET` are part of the URL, which access logs and proxies record.

A read-only call is sent as `GET`, with each argument as a query parameter named after the argument. Sent that way it is retried like any other `GET` (see [Automatic Retry with Backoff](../configuration/auto_retry.md)).

A read-only call is sent as `POST` instead, the same request a call without the option sends, when any argument cannot reach the function as a query parameter:

- Its name is one PostgREST reads as an option of the request (`select`, `columns`, `on_conflict`, `order`, `limit`, `offset`, `and`, `or`), or contains a `.`, which PostgREST reads as the path of an embedded resource.
- Its value is `null`, which a query parameter can only carry as the text `null`.
- Its value, written as a query parameter, starts like a filter: one of the operators `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `match`, `imatch`, `cs`, `cd`, `ov`, `sl`, `sr`, `nxl`, `nxr`, `adj`, `in`, `is`, `isdistinct`, `fts`, `plfts`, `phfts`, `wfts`, optionally preceded by `not.` and optionally followed by a parenthesised modifier such as `(english)` or `(any)`, then a `.`. PostgREST applies such a parameter to the result as a filter rather than passing it to the function, so over `GET` the argument is lost: a function without a default for it answers HTTP 404 with code `PGRST202`, and one with a default runs with the default.

Argument values are runtime data, so a value that cannot travel as a query parameter changes the method rather than failing the call. A call sent as `POST` this way is not retried.

## Errors

- A read-only call whose arguments are not a JSON object of named arguments, such as the whole body a function with a single unnamed `json` or `jsonb` parameter takes, is rejected before any request is sent, as the SDK's own argument error. A query string carries only named arguments, so such a body has no `GET` form.

## Related

- [Automatic Retry with Backoff](../configuration/auto_retry.md): retries a read-only call sent as `GET`, never a call sent as `POST`
- Typed Function Calls (`database.generated_types.typed_rpc`): follows the method rule above
