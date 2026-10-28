# Cline local services: any web page can drive the local runtime

Cline is a coding assistant that runs on the user's machine. Its front ends — a terminal, editor
integrations, a browser dashboard, and a desktop application — talk to local services over HTTP and
WebSocket connections to show sessions, change provider and MCP settings, drive agent turns, and
restart the local runtime.

## Observed impact

While the dashboard is running with its default local settings, a web page visited in the same
browser can open a WebSocket connection to the dashboard's loopback address and send a command
frame. The dashboard accepts the connection and performs the command against the user's machine —
for example, returning the local provider settings — even though the page was not served by the
dashboard.

## Security property

A local service must perform one of these actions only for a request that comes from a page the
deployment itself serves. A request whose origin is not an address the deployment is configured to
serve — including a request that presents no origin, an empty origin, or an unparseable origin —
must be refused with a client error before any action, state change, or reply. A request whose host
does not name the deployment must likewise be refused.

Serving the dashboard's own pages and the public resources they load is not one of these actions.
The dashboard page, its sub-pages, and its public version, health, configuration and asset
responses must keep loading for a browser that sends no origin, exactly as they do today.

Everything that works today must keep working. In particular:

- a connection from the dashboard's own page must still be accepted;
- a connection from the product's own local front end must still be accepted when that front end
  is served from a different local port than the service it connects to;
- a connection that uses the deployment's configured public address must keep working whether that
  address is a bare machine address with no port, an address that includes the listening port, or a
  tunnel hostname that deliberately carries no port.

The examples above are examples, not the full set: the property applies to every way a request can
reach one of these services.

## Constraints

- Fix the reported problem and its close variants: a request that can drive the runtime must not
  bypass the check by using a different connection or a different way of asking.
- Keep all legitimate use working, including every preservation clause above.
- Do not look up the upstream advisory or its fix.
- Do not special-case the example in this report.
