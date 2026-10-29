# Proxy forwards a caller-supplied client address

## What the system is

This project is a Go web framework. Its proxy middleware places one or more upstream servers behind an application: a request that reaches the middleware is forwarded to an upstream, and that server's response is returned to the caller. Applications use it as a reverse proxy and for load balancing in front of internal services.

## What a caller can do

A caller can make an upstream see a client address it does not own. The caller sends an ordinary request that carries an `X-Real-IP` header naming someone else's address, and the upstream receives that address as the address this middleware vouches for. Any rule, quota or audit record at the upstream that keys on the client address can then be bypassed.

One concrete trigger: an application forwards requests to an upstream through this middleware. A request carrying `X-Real-IP: 203.0.113.7` reaches the upstream with that address, even though the connection came from somewhere else.

## What must hold

Every request this middleware forwards to an upstream must arrive there describing the client address the middleware itself observed on the connection. A value the caller supplied in that header must never reach the upstream — not as the whole value and not alongside the real one. This must hold for every path by which the middleware forwards a request and for every form in which the value can be supplied; the trigger above is one example, not the full set.

Such requests must still be served. The requirement is that the upstream sees the observed address, not that the request is refused.

A value the application itself places on the outgoing request while the middleware prepares it is authoritative: the upstream must receive the value the application set.

Everything that works today keeps working exactly as today.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. There is no network access. Do not look up the upstream fix. Do not special-case the example.
