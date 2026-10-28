# Client cookies leak between origins

http4k is a Kotlin HTTP toolkit. Its client support can be configured with cookie handling:
`Set-Cookie` headers from responses are stored, and stored cookies are attached to later
outgoing requests.

## What goes wrong

A client that talks to more than one host sends one host's cookies to the other. For example:

1. A cookie-aware client requests `https://app.example/account`, and the response contains
   `Set-Cookie: session=marker-alpha`.
2. The same client then requests `https://other.example/`.
3. That second request carries `Cookie: session=marker-alpha`.

`other.example` must never learn a cookie that `app.example` set.

## Required behaviour

Treat a cookie as belonging to the origin that set it, and enforce that ownership wherever a
cookie is stored, selected, or carried into an outgoing request.

- A cookie may reach only the host that set it, or, when the response explicitly asks for a
  domain scope, a host within a domain that contains the setting host. A setting host must
  never be able to give a cookie to an unrelated domain or to a domain that merely shares
  the tail of its name.
- A cookie is confined to its path scope, and a cookie with no explicit path takes the
  default scope of the path where it was set. Domain and path matching must respect label
  boundaries.
- A `Secure` cookie only travels over `https`.
- Cookies with the same name set by different hosts are independent: one must not replace or
  expose another's.
- The same ownership must hold however an outgoing request is produced and however a cookie
  gets into it.

## Contracts

- There is no error response to produce. A correct implementation simply does not attach a
  cookie that is out of scope, and requests still complete normally with the status the
  handler returns.
- The existing public way of building a cookie-aware client must keep working, including the
  defaults, a caller-supplied clock, and a caller-supplied time source.
- Relative or host-less request URIs must keep round-tripping cookies set through the same
  client.
- A domain-scoped cookie must keep reaching subdomains; a path-scoped cookie must keep
  reaching its subtree; a cookie set on a deep path must keep covering sibling resources
  below that path.
- Expiry and removal must keep working.
- All existing single-origin behaviour must stay as it is today.

The examples above illustrate the property; they are not the full set of cases it covers.

## Constraints

- Fix the flaw and its close variants, not just the example shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue; work from the code and this
  report.
- There is no network access.
