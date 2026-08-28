# Wait for Postgres Changes Confirmation

## Behavior

By default, a channel is reported as successfully subscribed as soon as it joins the topic on the server, before the server has necessarily started streaming Postgres change events for that subscription. This creates a race: if replication for the subscription isn't active yet when the client starts treating the channel as ready, changes emitted in that gap can be missed.

Setting `postgres_changes_options.wait` to `true` on the channel config defers reporting a successful subscription until the server sends an explicit confirmation that the postgres_changes subscription is active and streaming. `postgres_changes_options.timeout` controls how long to wait for that confirmation, in milliseconds (default `15000`).

## Prerequisites

Only meaningful on a channel with a `postgres_changes` binding; has no effect on channels without one. Requires a Realtime server version that sends the subscription-active confirmation message.

## Errors

- subscription not confirmed — the server responds with `wait` enabled but the subscription cannot be confirmed active (e.g. replication setup failure); the subscribe outcome carries the server's reason instead of a false success
- timeout — the server does not confirm within `postgres_changes_options.timeout` milliseconds

## Notes

- Without `wait: true`, a successful subscription is reported on channel join regardless of postgres_changes streaming state — the existing default behavior is unchanged for callers who don't opt in.

## Related

- [Subscribe to Postgres Changes](realtime.subscriptions.postgres_changes) — the underlying subscription this option confirms
- [Subscribe](realtime.channel.subscribe) — the join call whose success is delayed by this option
