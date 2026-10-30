# Headroom proxy: a web page can drive the user's local sessions

Headroom is a local proxy that sits between a developer's tools and their model provider, and
serves a small browser dashboard on the same port. Besides ordinary requests it carries
long-lived streaming sessions that the provider answers over a single connection.

## What happens

With the proxy running on its default local port, a page served from `https://attacker.example`
can open a streaming connection to `ws://127.0.0.1:8787/v1/responses`. The proxy accepts the
connection and opens the matching provider session, using the credentials it holds when the page
supplies none, so the page can act as the user for as long as the session stays open.

## What must be true

No request may cause the proxy to accept, open or relay a provider session when the request
carries a browser origin that the proxy does not trust, however that request reaches the proxy.

These requests are legitimate and must keep working as they do today:

- requests that do not come from a browser and identify no origin;
- with no explicit origin configuration, requests whose origin is on the local machine (its
  loopback name or addresses), on any port;
- requests whose origin the operator has configured for the proxy's browser access. That
  configuration is a comma-separated list of origins and replaces the local-machine default; a
  single `*` in it still means "allow everything".

A request that is refused must be turned away at the handshake: the client gets a clean error,
the provider is never contacted for it, and no frame is relayed. Everything else that works
today keeps working exactly as today.

The example above is one example, not the full set. Fix the problem and its close variants, keep
legitimate use working, do not look up the upstream fix, and do not special-case the example.
There is no network access.
