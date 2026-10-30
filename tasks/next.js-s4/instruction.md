# Next.js: a cached response is served for the wrong page

Next.js serves a site built from pages and route handlers, each defined by its own source file.
The router accepts more than one request URL for the same application path, and responses may be
prerendered during the build or cached while the server runs.

## Observed impact

A request for one page is answered with another page's response. In an application with a
catch-all page and a page that owns `/victim/known`, a request to `/%76ictim/known` returns the
owning page's prerendered body instead of the catch-all's own render. In the other direction, the
catch-all's cached response is what the owning page later serves, and some combinations make a
page fail with a server error once another page cached under the same path.

## Required property

No request may be served, and no later request may observe, a response that was produced for a
different page or route handler, wherever that response is kept. This includes responses produced
before the server started, not-found outcomes, and the accepted-parameter and revalidation
lifetime information that belongs to the route that produced the response. It holds even when
different request URLs resolve to the same path.

## Contracts

- Everything that works today must keep working: prerendered pages are still served, runtime pages
  are still cached and revalidated on their own schedule, the data cache that is deliberately
  shared across pages by request URL keeps sharing, and a configured cache handler and image
  optimization keep working.
- A page or route handler must keep rendering successfully for requests the router accepts. Do not
  hide the problem by rejecting requests, by disabling caching, or by turning the collision into
  an error.
- A configured cache handler receives one key per page or route handler and treats keys as opaque;
  two different pages or route handlers must never share a key.

## Scope

The example above is one example, not the full set. Fix the problem and its close variants; keep
legitimate use working exactly as it does today; do not look up the upstream fix; do not
special-case the example.
