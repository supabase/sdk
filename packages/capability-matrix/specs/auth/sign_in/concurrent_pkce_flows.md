# Concurrent PKCE Flows (Flow ID)

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /token?grant_type=pkce` - the exchange a pending flow's verifier completes

## Behavior

Every call that starts a PKCE flow generates a flow ID and a code verifier, and stores a pending flow record before it sends its request or returns its URL. The calls are OAuth sign-in, SSO sign-in, OTP and magic link sign-in, sign-up, resend, password reset, an update of the user's email, and identity linking. The record holds the verifier, the flow's purpose, and the time the flow started. It is stored under a key of its own, derived from the flow ID, and an index lists the pending flows in the order they started. Two flows in flight at once, such as an OAuth sign-in started while a password reset email is unread, therefore never share a verifier.

The purpose is one of four values, set by the call that starts the flow:

- `recovery`: password reset
- `email_change`: an update of the user's email
- `link_identity`: identity linking
- `sign_in`: every other call above

The purpose decides the auth event the flow emits when it completes, as defined in [Session URL Detection](../../client/authentication_integration/session_url_detection.md).

The SDK keeps at most 5 pending flows. Starting a sixth removes the oldest record. A record expires one hour after its flow started: the SDK never uses an expired record, and removes it when it reads it. The bound and the expiry keep stale verifiers out of the newest-first search below.

When the request that starts a flow fails with an HTTP response, the SDK removes the record, because the server created no flow for it. When the request fails before any response arrives, such as on a timeout or a lost connection, the SDK keeps the record: the server may have created the flow, and its email may still arrive.

OAuth sign-in and identity linking return the flow ID together with the URL, because the app holds that URL until the flow completes. The other calls complete through an email link or a server redirect and have no response to carry the ID. An SDK may also add the flow ID to the redirect URL it sends as the `sb_flow_id` query parameter, so that the callback names its own flow. The flow ID is opaque to the server and to the app: only the SDK that wrote it parses it.

Exchanging a code for a session selects the verifier as follows:

1. With a flow ID, the SDK uses that flow's record and no other. The flow ID is the one the app passes to the call or, when it passes none, the `sb_flow_id` parameter of the redirect URL the code came from.
2. Without a flow ID, the SDK tries the pending flows newest first. When the server answers HTTP 400 with error code `bad_code_verifier`, the SDK tries the next older flow. It stops at the first success or at the first other error. The server keeps its flow state when the verifier does not match and deletes it only after a successful exchange ([handler](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/token.go#L249-L278)), so a wrong guess does not spend the code.

A successful exchange removes the record it used. A record that the search in step 2 tried and the server rejected stays pending: the rejection shows that this code is not the flow's, not that the flow ended. When the app passed a flow ID, an HTTP response that rejects the exchange removes that flow's record, and a failure before any response keeps it, so the app can retry.

## Errors

- No pending flow: an exchange whose flow ID has no record, or whose record expired, fails with the SDK's own error before any request is sent. So does an exchange without a flow ID when no flow is pending. A request without a verifier would get HTTP 400 with error code `validation_failed`, and a request with the wrong one HTTP 400 with `bad_code_verifier`.
- A flow ID never falls back to another flow. The app or the redirect named the flow, so a missing record means a stale callback or a bug in the app, and a guess would hide it.
- `bad_code_verifier` without a flow ID: the SDK tries the next older pending flow, as in step 2. When every pending flow is rejected, the exchange fails with the last `bad_code_verifier` error.

## Related

- [Session URL Detection](../../client/authentication_integration/session_url_detection.md): reads the code and `sb_flow_id` from a redirect, and maps the purpose to an event
- Exchange Code for Session (`auth.sign_in.exchange_code_for_session`): the call this feature selects a verifier for
- Sign In with OAuth (`auth.sign_in.sign_in_with_oauth`): returns the flow ID with its URL
- Link Identity (`auth.identities.link_identity`): returns the flow ID with its URL
