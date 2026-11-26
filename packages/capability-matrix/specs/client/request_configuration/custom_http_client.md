# Custom HTTP Client

Supply a custom HTTP client at construction time. Every sub-client sends its
requests through the custom HTTP client.

## Behavior

### Redirects

The SDK applies the rule set out in
[Redirects stay on the origin](../../../../../docs/principles.md#redirects-stay-on-the-origin)
to every request that the SDK sends through the custom HTTP client, whatever the
custom HTTP client's own redirect settings are. The SDK does not change those
settings. For the app's own requests outside the SDK, the custom HTTP client
still handles redirects as the app set it up to.

A custom HTTP client can follow a redirect itself, before the SDK sees the
redirect, thus outside of the SDK's scope of control. For example, a replacement
`fetch` function can ignore the `redirect: "manual"` option that the SDK passes
to it. When the SDK cannot prevent that, the SDK's docs for the custom HTTP
client option must state that the custom HTTP client must not follow a redirect
to another origin.
