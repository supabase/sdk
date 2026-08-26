# Sign-Out Reason

Surface *why* the user was signed out alongside the sign-out auth event, so listeners can tell a voluntary sign-out apart from an involuntary one (for example, an expired session) and react accordingly.

This is a client-side capability. It makes no HTTP call of its own; it annotates the sign-out event that the SDK already emits through [Subscribe to Auth Events](auth.session.subscribe_auth_events).

## Behavior

When the SDK emits a sign-out event, it also exposes a reason describing what caused the sign-out. The reason is carried on the event (or its payload) so a plain auth-state listener can read it without registering a separate error handler.

The reason takes one of the following values:

- **user-initiated** — the application explicitly called sign-out.
- **session-expired** — the refresh token was rejected (invalid or expired) and the stored session was removed without the user asking to sign out.
- **session-missing** — a previously stored session could not be recovered because it was absent or missing required data.

The reason is only meaningful on the sign-out event. For every other auth event (sign-in, token refresh, user update, and so on) the reason is absent.

SDKs that surface auth events but cannot determine the cause should treat the reason as absent rather than guessing.

## Prerequisites

The SDK must emit authentication state change events — see [Subscribe to Auth Events](auth.session.subscribe_auth_events).

## Notes

- The naming of the reason values and the way the reason is attached to the event are implementation details that vary across SDKs. What this capability requires is that the three cases above are *distinguishable* by a listener.
- When sign-out events are propagated between application instances (for example, across browser tabs over a broadcast channel), the reason may not be available on the propagated event. Implementations should treat a cross-instance sign-out as having no reason rather than inferring one.
- The primary motivation is letting applications respond differently to an involuntary sign-out (such as an expired session) than to a deliberate one, for instance by notifying the user instead of silently returning to a signed-out state.

## Related

- [Subscribe to Auth Events](auth.session.subscribe_auth_events) — the event stream the reason is attached to
- [Sign Out](auth.session.sign_out) — the explicit sign-out that produces the user-initiated reason
- [Refresh Session](auth.session.refresh_session) — a rejected refresh is what produces the session-expired reason
