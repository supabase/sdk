# Invoke Function

Build the request URL of a function invocation from the function name, including
a query string written into the name.

## API

Guide:
[https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)

- `POST /functions/v1/<function name>`: the method varies with the invocation's
  method option

The headers, body, authorization, region selection, and streaming of an
invocation are defined by their own capabilities. This file covers only the URL.

## Behavior

The request URL is the functions base URL, a `/`, and the function name, in that
order. The SDK parses the function name as the path and query of a URL, so the
name can carry a query string.

1. **Path.** The part of the name before the first `?` is the path segment
   appended to the functions base URL.
2. **Query.** The part of the name after the first `?` is a query string. The
   SDK sends it as the URL query, in the same form the caller wrote it, and
   never percent-encodes the `?` into the path.
3. **Fragment.** A `#` in the name starts a fragment. The SDK drops the fragment
   and everything after it, as a fragment is never sent over HTTP.

For example, the name `search?q=x` requests `/functions/v1/search?q=x`, not
`/functions/v1/search%3Fq=x`.

The query items from the name merge with the query items the SDK adds. Those are
the per-call query options, for an SDK that has them, and the
`forceFunctionRegion` item that region selection adds. When the same name
appears in both the function name and an added item, the added item replaces the
one from the name. Items with other names from the name are kept.

For example, with the region `eu-west-1`, the name
`search?q=x&forceFunctionRegion=us-east-1` requests
`/functions/v1/search?q=x&forceFunctionRegion=eu-west-1`.

## Notes

- **Assert the exact request URL.** A name with a query, and a name with a query
  plus a region, each get a test that asserts the full URL the request carries.
  A path-append API in a standard library, such as one that adds a path
  component or joins a base and a relative reference, percent-encodes `?` as
  `%3F` and still produces a well-formed URL, so a test that checks only the
  path, or only that the call succeeded, passes while the request goes to a
  function that does not exist.

## Related

- Region Selection (`functions.invocation.region_selection`): adds the
  `forceFunctionRegion` item that this file merges with the name's query
- Invocation Auth Token (`functions.invocation.auth_token`): the authorization
  header of the same call, defined separately from the URL
