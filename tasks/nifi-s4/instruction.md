# A request can make the application advertise an attacker's host

## System

Apache NiFi is a data-flow automation platform. Its web application serves a browser interface and a REST API. Deployments commonly sit behind a reverse proxy and declare the public addresses (host names, optionally with ports) that the application should advertise when it generates absolute URLs, for example in redirects that send a browser back into the application.

## Observed impact

A request to the logout-complete page that carries a proxy host header naming a host the deployment never declared is accepted, and the redirect the application returns points at that host:

```
GET /nifi/logout-complete HTTP/1.1
Host: nifi.internal
X-ProxyHost: attacker.invalid
```

The response is a 302 whose Location is an absolute URL on `attacker.invalid`, using the application's local port. A browser that follows it leaves the application for a host the attacker controls. Other proxy-address values the application understands reach the same outcome.

## Security property

No proxy-address value supplied by a request — the host or port that a front-end proxy reports as the original address — may determine the host or port of an absolute URL the application generates unless it names a host and port that the administrator declared as an allowed public address. This holds for every request, whatever connection it arrives on, and for every value such a header carries.

An acceptable response is not a server error. A request that cannot be honored is refused with a client error, or handled without advertising the disallowed address; either way it has no side effect.

The administrator declares the allowed public addresses as host names, each optionally with a port. The application's own listening port is also acceptable.

The examples above are illustrations, not the full set of ways the property can be violated.

## Must keep working exactly as today

- Direct requests that state no proxy address keep using the address they arrived on.
- Every allowed public address keeps being advertised however the request states it, including when the request gives it an explicit port, states the port separately, or repeats it.
- The application's existing behaviour for an allowed address does not change.

## Constraints

- Fix the flaw and its close variants, not only the example shown.
- Keep legitimate use working.
- Do not consult any upstream advisory or fix for this issue.
- Do not special-case the example.

There is no network access.
