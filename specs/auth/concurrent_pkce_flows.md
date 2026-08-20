# Concurrent PKCE Flows (Flow ID)

## Behavior

When the client is configured for the PKCE auth flow, every call that starts a
new PKCE flow (OAuth sign-in, OTP sign-in, SSO sign-in, resend, update-user
email change, password reset, identity linking) generates a **flow id** —
an opaque, SDK-generated identifier — alongside the usual code
verifier/challenge pair. The verifier is written to a storage slot keyed by
that flow id, not to a single shared slot. This lets several PKCE flows be in
flight at the same time (e.g. two OAuth sign-ins started from different
windows/tabs, or an OAuth flow started while a password-reset flow from an
earlier email is still pending) without one flow's verifier silently
overwriting another's.

Flow-id slots are bounded: the SDK keeps at most **5** pending flows at once.
Starting a 6th flow evicts the oldest still-pending slot. This is a fixed
implementation limit to bound storage growth, not something callers
configure or observe directly — abandoning many PKCE flows without
completing them is expected to be rare.

Exchanging the code for a session accepts an **optional flow id**:

- With a flow id, the SDK resolves the verifier from that flow's slot only.
- Without a flow id, the SDK falls back to whichever verifier was stored
  most recently — the pre-existing single-flow behavior, kept for backward
  compatibility with callers that predate flow ids or that have no way to
  obtain one (see below).

Only the flows that hand a live value back to the caller before the flow
finishes — starting an OAuth (or OAuth-based identity-linking) sign-in —
return their flow id in the call's response, since the caller is the one
who will eventually need to pass it back in to select the right verifier.
Every other PKCE-initiating flow (SSO sign-in, OTP sign-in, resend, password
reset, update-user email change) completes out of band, via a link emailed
to the user or a server-side SSO redirect, with no in-process response to
attach a flow id to; those continue to rely on the most-recently-stored
fallback unless the SDK also gives the caller some other way to correlate
the eventual callback to the flow that started it (for example, threading
an application-defined identifier through the `redirectTo` URL).
Implementing that correlation channel is optional and does not block
calling this feature "implemented."

## Errors

- Exchanging with an explicit flow id whose slot is missing, expired, or
  already evicted from the ring must fail with the SDK's normal "verifier
  not found" error — never fall back to a different flow's verifier. Reusing
  the wrong verifier would consume the single-use auth code for the wrong
  flow and instead of failing predictably, corrupt the other flow's
  eventually consistent state.

## Related

- [Exchange Code for Session](auth.sign_in.exchange_code_for_session) — the operation this feature adds a flow id selector to.
- [Sign In with OAuth](auth.sign_in.sign_in_with_oauth) — a flow whose response surfaces the new flow id.
- [Link Identity](auth.identities.link_identity) — the identity-linking equivalent of the OAuth sign-in flow, also surfaces a flow id.
