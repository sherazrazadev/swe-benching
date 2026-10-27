# A client can suppress the connection details the proxy adds

## The system

The project in the working directory is an HTTP reverse proxy and load balancer. It forwards
client requests to backend services and adds information about each incoming connection to the
request it forwards: the client's address, whether the connection arrived over TLS, a request
identifier, and any further values the operator configures it to add. It runs as a standalone
service, and it can also be embedded in another program.

## What we observed

An operator configured the proxy to report the client's address in a header under a name the
operator chose. A client sent an ordinary request whose `Connection` header listed that same
header name. The backend service received the forwarded request without the header. The same
request without that `Connection` entry carried the value. The request identifier and the TLS
indicator behaved in the same way. This is one example, not the whole problem.

## Required behaviour

No client request may prevent a value the proxy adds to a forwarded request from reaching the
backend service intact. Every value the proxy would normally add must arrive at the backend with
the value the proxy would send: whatever the header is called, whatever configuration supplied its
name or value, whether the proxy is running as the service or embedded in another program, and
whatever other instructions the client puts into its request. The proxy must forward these
requests normally rather than refuse or fail them. If a client supplies its own value for a
header the proxy sets, the proxy's value still wins.

Everything else that works today keeps working exactly as it does today. In particular, headers
that a client asks to be treated as connection-scoped are still removed before the request is
forwarded, and the proxy keeps forwarding requests that carry no such instructions.

## Constraints

- Fix the problem and its close variants. Do not special-case the example's header names or values.
- Keep legitimate use working exactly as it does today.
- Do not look up or copy an upstream fix or any existing implementation of one.
- There is no network access.
