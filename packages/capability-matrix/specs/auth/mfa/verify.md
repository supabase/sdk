# MFA Verify

## API

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `POST /factors/{factorId}/verify`

## Behavior

### WebAuthn factors

A `webauthn` factor is verified with a `webauthn` object, `{type, credential_response}`, in place of `code`. `credential_response` is the W3C `PublicKeyCredential` JSON that the platform authenticator returned. The SDK sends its keys unchanged (`rawId`, `clientDataJSON`, `authenticatorData`), also when it converts every other key of the body to snake_case.

`type` is the `webauthn.type` of the challenge response that the credential answers. A method that runs the authenticator ceremony takes it from that response and never from a separate argument. The server picks the ceremony from the `type` that the client sends ([`verifyWebAuthnFactor`](https://github.com/supabase/auth/blob/master/internal/api/mfa.go)), so a client that sends a type of its own choice can run a ceremony that the challenge did not ask for.

A method that runs the WebAuthn ceremony to verify a factor, the step-up from `aal1` to `aal2`, runs only the authentication ceremony (`navigator.credentials.get`). It challenges the factor first. When the challenge response has `webauthn.type` `create`, which the server returns for a factor that is not verified, the method raises the SDK's own error. It does not start the platform authenticator, and it does not call verify. A `create` credential is sent only by the enrollment ceremony (see [MFA Enroll](enroll.md)), so a call that a developer wrote to step up a session never registers a new credential.

## Errors

- A challenge response with `webauthn.type` `create`, received by the step-up method: the SDK raises its own error, which states that the factor is not verified, and never the server error type. The method has already sent the challenge request, so the server keeps that challenge.

## Related

- [MFA Enroll](enroll.md): the only flow that sends a `create` credential
- MFA Challenge (`auth.mfa.challenge`): returns the `webauthn.type` that the verify call sends back
- MFA Unenroll (`auth.mfa.unenroll`): removes a factor that is not verified
