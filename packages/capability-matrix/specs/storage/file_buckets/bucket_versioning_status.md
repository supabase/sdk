# Bucket Versioning Status

Enable, suspend, or read a bucket's object versioning status. When enabled, writes to a path create a new version instead of overwriting the existing one; noncurrent versions are retained and addressable until explicitly deleted.

## API

- `POST /bucket`: create-time status
- `PUT /bucket/{id}`: update-time status
- `GET /bucket/{id}` / `GET /bucket`: reported status

## Behavior

`versioning_status` is one of three values, but the set a caller may *write* differs from what a bucket may *report*, and depends on whether the call is a create or an update:

- **`DISABLED`**: the implicit starting state for every bucket. Versioning has never been enabled. Settable at create time (or omitted; omitting it at create time defaults to `DISABLED`). Not settable at update time: once a bucket has ever had versioning touched, there is no legal transition back to `DISABLED`.
- **`ENABLED`**: new writes to the bucket create a new version. Settable at create time and update time.
- **`SUSPENDED`**: versioning was enabled, then paused. Existing versions are retained, but new writes replace the current logical null version instead of retaining each write as a distinct noncurrent version. Deletes similarly create or replace a logical null delete marker. Settable at update time after the bucket has reached `ENABLED`; an idempotent `SUSPENDED` to `SUSPENDED` update is also accepted. A bucket cannot be created directly in `SUSPENDED`, and cannot transition to it from `DISABLED`.

So: create accepts `DISABLED`/`ENABLED`; update accepts `ENABLED`/`SUSPENDED`. Reads (`GET`) may return any of the three.

## Prerequisites

None to enable versioning on a new bucket. A bucket must reach `ENABLED` before it can transition to `SUSPENDED`.

## Errors

- Sending `versioning_status: DISABLED` on an update call is rejected, regardless of whether it matches the bucket's current status. `DISABLED` is not a member of the update-time value set at all.
- Requesting `SUSPENDED` at bucket creation is rejected; it is not a member of the create-time enum at all.

## Notes

- SDKs are free to model the create-time and update-time settable value sets as two distinct types rather than one shared three-value enum, to catch an illegal value (e.g. `DISABLED` on update) at compile time instead of deferring to a server-side rejection.
