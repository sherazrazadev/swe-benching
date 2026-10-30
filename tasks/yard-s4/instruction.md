# Documentation server serves and stores files outside its documentation root

YARD is a Ruby documentation tool. Besides generating documentation, it ships a
small documentation server: it can be started from the command line or embedded
in a Ruby web application, it renders documentation pages on request, and when it
is given a documentation root — the directory where generated pages are kept — it
caches rendered pages there and serves them from there on later requests.

The documentation root is meant to be the only place the server keeps and takes
static documentation from. A request path that walks upward out of it defeats
that: a page stored next to the root is served back to the caller as if it were
part of the documentation. For example, with a documentation root at
`/srv/docs`, a request for `/../secret.html` returns the contents of
`/srv/secret.html` when that file exists. The same boundary is not respected
everywhere the server uses a request path to locate something under the root,
including when the server itself places pages there and when it operates on pages
later.

**Invariant.** The documentation root is a hard boundary for every
request-derived location the server resolves against it. No request may make the
server read, create, overwrite, change or delete, outside that root, a file it
locates relative to that root. This holds however the request path is written,
whether the file already exists or was written out by the server itself while
serving an earlier request, and for every operation the server performs against
the root. Only the root itself and genuine descendants of it may be touched: a
file or directory whose name merely begins with the same characters as the root
is outside the boundary. The example above is one example, not the full set of
inputs or places.

**Contracts.**

- When a request would require touching a location outside the root, the server
  must not perform that access. Where the server refuses such a request, the
  answer is a client error (a 4xx status), never a success that carries the
  outside content and never a server error.
- Everything that works today must keep working exactly as today. In particular:
  a page cached under the root is still served, requested with or without its
  page suffix; the mount prefix under which the server is exposed remains part
  of the location the server looks up; a page name that merely contains two dots
  is still an ordinary page; a rendered page is still written under the root and
  served from there on a later request; the index page still renders and is still
  cached; and every other operation the server offers over the root still behaves
  as it does today.
- A normal, deeply nested page path under the root is legitimate and must not be
  disturbed; so is a page whose name merely contains two dots. Only a location
  that actually resolves outside the root is a violation.

Fix the problem and its close variants; keep every legitimate use working; do not
look up the upstream fix; do not special-case the example.
