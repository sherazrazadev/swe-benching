# Requests can be served under a host the operator never allowed

Litestar is a Python web framework for building ASGI applications. An application can be
configured with the set of host names it serves, and the framework is expected to refuse every
request whose host is not in that set, whatever the request is. Host names may be given
exactly, as wildcard subdomains, or with a port; for some configured names the framework
answers a request made to the name's other form with a redirect instead.

**Observed impact.** An application configured to serve `ok.example.com` runs its handler for a
request that carries no `Host` header at all but sets `X-Forwarded-Host: ok.example.com`. The
connection was never addressed to an allowed name; the client simply named one in a different
header, and the application treated it as trusted. This is the kind of bypass that lets an
attacker reach a host-restricted application through a name it does not control.

## Required behaviour

- Every request the application handles is identified by the host the connection is actually
  addressed to. That host, and only that host, decides whether the request is allowed.
- No value a client supplies, in any header and in any form, may create, replace, extend or
  stand in for that host. A value that merely starts with an allowed name, or that carries
  anything besides a plain host name and an optional port, does not identify that allowed name.
- Nothing the application derives from a request may name a host other than the allowed one:
  neither what it sends back to the client nor any address it builds from the request.
- A request that does not present an allowed host - including one that presents none - is
  refused with a client error and no side effect. The application does not handle it in any way.
- The refusal is the same response for every request whose host is not allowed, whatever else
  the request carries.

## Everything that works today keeps working

- Names the operator allows are served, including wildcard forms, names given with a port, and
  the case where the operator allows every host.
- A request for a variant form of an allowed name that the application currently answers with a
  redirect still gets that redirect.
- A request that presents an allowed host is still served when it also carries unrelated
  forwarding headers; those headers must not change the host or cause a refusal.

The example above is one instance, not the full set of affected inputs.

## Constraints

- Fix the problem and its close variants, not only the example.
- Keep legitimate use working.
- Do not look up the upstream fix or any existing implementation of it.
- Do not special-case the example.
- There is no network access.
