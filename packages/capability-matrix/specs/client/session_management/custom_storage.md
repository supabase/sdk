# Pluggable Session Storage

Persist the session, and the pending PKCE flow records, in a storage the app can replace, and default to a secure one where the platform has one.

This is a client-side capability. It makes no HTTP call.

## Behavior

### What the SDK stores

The SDK stores two kinds of values under string keys: the session, and one record per pending PKCE flow (see [Concurrent PKCE Flows](../../auth/sign_in/concurrent_pkce_flows.md)). A PKCE code verifier is a secret until its flow ends, so the SDK keeps it in the same storage as the session and never in a weaker one.

The storage offers three operations on a key: read, write, and remove. Writing replaces an existing value. Removing a key that holds nothing succeeds.

### Absent is not unreadable

A read answers that the key is absent only when nothing is stored under it. A read that cannot complete, for example because the device is locked before its first unlock or the secure store is unavailable, fails with an error and never answers that the key is absent. The SDK treats an absent session as signed out, so an unreadable storage reported as absent would sign the user out.

While the stored session cannot be read, the SDK does not know whether a user is signed in. It reports that state as not yet known, and delivers no auth event until the read succeeds, as Subscribe to Auth Events (`auth.session.subscribe_auth_events`) defines for `INITIAL_SESSION`. It reads again when a call needs the session, and when the platform says that protected data is available again.

### Stored data the SDK cannot decode

A stored session that the SDK cannot decode is removed from storage, and the client is signed out with the reason session-missing (see [Sign-Out Reason](../../auth/session/sign_out_reason.md)). A read cannot repair that data, so the SDK does not retry it.

### Write and remove failures

A write or a remove that fails fails the operation that needed it with the storage's error. The SDK never ignores a failed write. The failed operation changes nothing the app can see: the state the app reads stays as it was, and the SDK emits no auth event, so the app never hears of a session that was not stored. The SDK writes the new session to storage before it updates that state and before it emits the event, so an app that reads the session while it handles an event reads the state the event describes.

### Secure default

A session is a credential. On a platform that has an operating system store for app secrets, such as the Keychain or a Keystore-backed store, the default storage is that store.

When the default storage is a keychain:

- The item is readable after the first unlock since boot, so a refresh in the background works while the device is locked.
- The item stays on the device: it is excluded from backups that restore to another device and from cloud sync. The app opts in to sync, and sync requires an accessibility that is not limited to this device.
- An item that an earlier release stored with another accessibility moves to the default one by an update in place on the first write. The SDK never deletes the item and adds it again, because a failure between the two steps would lose the session.

### No silent loss

The SDK never drops a write. A storage that persists nothing keeps the written value in memory for the lifetime of the client, so a read after a write returns the written value. A default that persists nothing is a documented choice for a platform with no store to write to, not a fallback the SDK takes without saying so.

## Notes

- The secure default applies only where an operating system store for app secrets exists. Where none does, such as in a browser, the platform's standard storage for the app is the default, or memory when the platform has none.
- A storage the app supplies replaces the default and its accessibility rules. The read, write, and remove rules above apply to it.

## Related

- Session Persistence Toggle (`client.session_management.persist_session`): keeps the session in memory only
- Subscribe to Auth Events (`auth.session.subscribe_auth_events`): the events that a failed write does not emit
- [Concurrent PKCE Flows](../../auth/sign_in/concurrent_pkce_flows.md): the pending flow records stored beside the session
