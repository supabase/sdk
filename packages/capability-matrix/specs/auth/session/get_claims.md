# Get Claims

Verify a JWT access token and return its claims, together with the token's decoded header and raw signature bytes. This is the fast path for request-time authentication: it establishes who the user is and how they authenticated using the project's published public keys, without a per-request round trip to the Auth server whenever local verification is possible.

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `GET /.well-known/jwks.json` - fetches the project's published JWK Set on a key-cache miss
- `GET /user` - the server-side verification fallback for tokens that cannot be verified locally

## Behavior

The input is a JWT access token. SDKs that hold a session default to the current session's access token when none is supplied, and stateless server-side SDKs require it explicitly.

Verification proceeds in order, cheapest first:

1. **Decode.** The token must be three base64url segments carrying a JSON header and JSON payload. Malformed input fails here with no network traffic.
2. **Expiry.** The `exp` claim must be present and in the future, judged against the local clock with no skew allowance. (Some SDKs offer an opt-in flag that skips this check for callers that need to inspect expired tokens.)
3. **Route.** If the header declares an asymmetric signing algorithm the SDK can verify locally (for example ES256 or RS256) and names a key id (`kid`), verification is local. Any other token - one signed with the legacy HS256 shared secret, or missing an algorithm or key id - is verified by calling [Get User](auth.session.get_user) instead: a successful response proves the server accepts the token, and the claims from step 1's decode are returned.
4. **Resolve the key.** The `kid` is looked up in the cached JWK Set. An unknown `kid` forces a refetch even when the cache is fresh, so freshly rotated signing keys are usable immediately. If the refetched document still lacks the `kid`, fall back to server-side verification as in step 3.
5. **Verify.** The signature is checked over the `header.payload` signing input using the matched public key. Success returns the claims, the decoded header and the raw signature bytes. Failure is an invalid-signature error.

The JWK Set is cached in the client for ten minutes, matching the `Cache-Control: public, max-age=600` the endpoint serves. The cache is shared across calls, and concurrent misses should coalesce into a single fetch.

Bind the verification algorithm from the **matched JWK**, not from the token header. The attacker controls the header but not the published key set, so keying off the JWK removes the algorithm-confusion bug class by construction.

## Prerequisites

Local verification requires the project to publish at least one asymmetric signing key. A project still on the legacy symmetric secret publishes an empty `keys` array, which is valid and must route every token through the server-side fallback rather than fail.

## Errors

- Malformed token, expired token and invalid signature are client-side failures, named per SDK convention.
- When verification falls back to the server, a rejection surfaces the server's error - `bad_jwt`, `session_not_found` and similar codes pass through from [Get User](auth.session.get_user).

## Notes

- The JWK Set endpoint serves only public keys. A public key can check a signature but never produce one, so the document is safe to serve unauthenticated and safe to cache. A symmetric legacy secret could mint tokens if published, which is why it never appears there and why those tokens take the server round trip.
- Verified claims prove identity as of token minting. They cannot prove the session still exists: a revoked session's token keeps verifying locally until it expires. Decisions that must respect revocation belong on [Get User](auth.session.get_user).

## Related

- [Get User](auth.session.get_user) - the server-side fallback, and the revocation-aware alternative when freshness matters
