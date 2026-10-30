# Reactor Netty: request credentials follow a redirect to a less protected destination

Reactor Netty is a Reactive Streams HTTP client and server for JVM applications. An application
builds an HTTP client, supplies the values its requests need — an `Authorization` credential, a
proxy credential, a session cookie — and can have the client follow redirect responses
automatically.

## What we observed

A service sends a request to an HTTPS address with an `Authorization` header. The server at that
address answers with a redirect to the plain-HTTP address of the same host and port. The client
follows the redirect, and the plain-HTTP server receives the `Authorization` value that the
application supplied for the protected address. Nothing in the application asked for that value
to travel to the unprotected one.

## What must be true

The values an application supplies to authenticate or identify its requests are private to the
destination they were supplied for. When the client follows a redirect, no supplied
`Authorization`, `Proxy-Authorization` or `Cookie` value may reach a destination that is less
protected than the one it was supplied for. A different host or a different port is a different
destination, and a destination reached without transport encryption is less protected when the
request the value was supplied for was encrypted. The rule applies to every request the client
emits while following redirects, however the value was supplied to the client.

## Contracts

- Following redirects keeps working: the client still follows a redirect and still processes the
  eventual response; only the forwarding of those values to a less protected destination stops.
- A redirect that does not lower the protection of the destination keeps working exactly as
  today: a value supplied for the original request is still delivered to the redirect target.
- Everything else that works today keeps working exactly as today.
- The example above is an example, not the full set of forms the values, destinations and
  redirects can take.

## Constraints

- Fix the problem and its close variants, not only the example.
- Keep legitimate use working.
- Do not look up the upstream fix or advisory.
- Do not special-case the example.
