# Server-side request forgery in the chat proxy

LobeChat is a self-hosted chat application. The browser client asks the application server to
retrieve some resources on its behalf, because cross-origin restrictions stop the browser from
fetching them itself; the server's answer is then shown or stored by the application.

## Observed impact

A visitor who is not signed in can make the server retrieve the contents of a service that is
reachable only from the server's own host or network, and read them back through the
application. For example, an HTTP client that posts the body `http://127.0.0.1:8080/` to the
application's proxy endpoint receives the body of that local service's response — a service the
visitor could not reach from their own machine.

## The rule that must hold

Whenever the server retrieves a resource because a request asked it to, it must connect only to
destinations that are publicly routable. It must never contact a loopback, link-local, private,
unique-local, unspecified, multicast, or otherwise non-public destination — not as the first
connection, and not as any later connection the server makes while serving that request,
however the requested location reached the server.

If the server cannot establish that a destination is publicly routable, it refuses the call
with a client error and makes no outbound connection to that destination.

## What must keep working

Every publicly routable destination keeps working exactly as today: plain HTTP as well as
HTTPS, any port, any path and query, and the same response status, body and response headers.
Where a retrieved response refers the server to another resource that it retrieves as part of
the same call, that behaviour is unchanged when the referenced resource is publicly routable.

The addresses and ports above are examples, not the complete set of inputs. The same rule
applies to every form a non-public destination can take and to every way a request can name
one.

## What to do

- Close the described behaviour and the close variants that reach the same outcome.
- Keep the legitimate use described above working.
- Do not look up or copy an existing or upstream implementation.
- Do not special-case the example address or port.
- There is no network access.
