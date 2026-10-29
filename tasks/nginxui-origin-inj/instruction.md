# Nginx UI — client address trust boundary

## The system

Nginx UI is a self-hosted web application for managing an Nginx web server. Its
normal deployment is a container image that runs its own bundled Nginx in front
of the Go backend: that bundled proxy accepts the request from the network and
forwards it to the backend over the local loopback interface, adding the usual
reverse-proxy client-address headers. The same application is also deployed
without that bundled proxy, reached directly or through a reverse proxy the
operator runs.

Administrators can restrict access to the application with an address allowlist,
and the application stops accepting sign-in attempts from an address after too
many failures. Both decisions are made from the address the application believes
the request came from.

## Observed impact

In a deployment that uses the bundled proxy, a person connecting from an address
that is not on the allowlist is still served. Every request reaches the backend
from the proxy's own local address, and the backend treats that address as the
client, so the allowlist never sees the real caller. The same mistake makes the
sign-in lockout a single shared bucket, so one person's failed attempts can stop
everyone else from signing in. One concrete trigger: with an allowlist that does
not contain the caller's address, an ordinary request from that caller, sent
through the deployment's bundled proxy, still reaches the protected endpoints.

## Security properties that must hold

- The address a request is attributed to must be derived only from a peer the
  deployment trusts. A client-address header forwarded by a peer that is not a
  trusted proxy must never change that attribution; it must be ignored.
- When the deployment runs the application's own bundled proxy, that proxy's
  local peer address is trusted automatically, with no configuration. When the
  bundled proxy is disabled or absent, no peer is trusted implicitly.
- The address allowlist is enforced against the derived client address on every
  protected route. A caller outside the allowlist receives a client error and
  the request has no effect.
- The sign-in attempt lockout is keyed on the derived client address at every
  sign-in entry point, so one client's failed attempts never block another
  client.
- When an allowlist is in force and the client address cannot be derived from
  the request, the request must not be treated as trusted.

## Contracts the fix must honour

- **Refusal.** When a request is not allowed, respond with a client error (4xx)
  and cause no side effect. Any client-error form is acceptable.
- **Keep working.** A client whose derived address is on the allowlist is served
  exactly as today, and a client connecting directly from the local machine is
  still allowed even when the allowlist is set. In a deployment where the
  bundled proxy is disabled or absent, a request arriving over loopback is not
  attributed to a forwarded address. Ordinary sign-in attempts keep working: a
  client that has made fewer failed attempts than the limit is not locked out,
  and an unset allowlist continues to permit requests.
- **Magnitudes.** With an allowlist containing `203.0.113.20` but not
  `198.51.100.20`, a request that genuinely comes from `203.0.113.20` through
  the deployment's proxy is served, while one that comes from `198.51.100.20`
  is refused even if it presents `203.0.113.20` in a forwarded header.

The examples above are illustrations, not the full set of inputs or routes the
properties cover.

## Constraints

- Fix the flaw and its close variants, not just the example.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
