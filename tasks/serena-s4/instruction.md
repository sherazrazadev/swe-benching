# Serena's dashboard answers requests that come from any website

Serena is a coding-assistant toolkit. While it runs, it serves a small web dashboard on the
local machine: a browser on that machine shows the session log, the active project and the
available tools, and the dashboard can save memories, change configuration and shut the agent
down.

A page on an unrelated website can make that browser send requests to the dashboard and have
them carried out. We saw a request issued by such a page, addressed to the page's own site
name, get answered, and the agent shut down: the dashboard treated it as an ordinary local
request.

**What must hold.** The dashboard, and every local HTTP service that is part of the dashboard
feature, must serve a request only when the request names a loopback address of this machine
(for example `localhost` or `127.0.0.1`). Every other request must be refused with a client error before it
can read or change anything.

That rule covers the whole request, not the example above: no path, method or body may let a
request through.

**What must keep working.** Everything that works today keeps working exactly as today. A
request that names a loopback address is served as before, whatever port the client used to
reach the service, including a port other than the one the service listens on. The dashboard
pages and the actions they offer keep working for those clients.

The examples above are examples, not the full set.

**Constraints.**
- Fix the reported problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or any existing implementation.
- Do not special-case the example.
- There is no network access.
