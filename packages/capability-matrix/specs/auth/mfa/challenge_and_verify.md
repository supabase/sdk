# MFA Challenge and Verify

Create a challenge and answer it with a code in one call.

## Behavior

The SDK runs [challenge](challenge.md) for the factor with no body, then [verify](verify.md) with the returned challenge `id` and the caller's `code`. Everything verify specifies applies: the whole stored session is replaced, the MFA-challenge-verified event is emitted, and the new session is returned.

If challenge fails, the SDK returns that error and sends no verify request. If verify fails, the SDK returns that error and leaves the created challenge to expire.

This capability applies to factors answered with a code, `totp` and `phone`. It cannot pass a channel, so a phone factor receives its code on the server's default channel. It cannot pass relying-party options or a credential response, so WebAuthn factors use [challenge](challenge.md) and [verify](verify.md) separately.

## Notes

- For a phone factor the code is sent by the challenge step, so the caller does not have the code when this call starts. Callers should call [challenge](challenge.md) and [verify](verify.md) separately for phone factors.

## Related

- [MFA Challenge](challenge.md)
- [MFA Verify](verify.md)
- [MFA Enroll](enroll.md): creates the factor
