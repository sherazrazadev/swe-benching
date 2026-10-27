# pyLoad web interface — a client chooses the address it is seen as

## What this is

pyLoad is a self-hosted download manager. Its web interface serves an RPC API
for external clients together with a browser user interface, and a small set of
its endpoints exist only for the local machine. Deployments may run the web
interface on its own or behind one or more reverse proxies.

## Observed problem

A client can choose the address the web interface attributes its requests to by
sending a forwarding header. Concretely, a client that repeats an RPC API call
while changing the address it claims in that header is never throttled: each
claimed address starts a fresh per-client request budget. The same
client-supplied value decides the client address recorded in the web
interface's audit entries.

## Security invariants

- The client address the web interface uses to throttle requests, and the
  client address it records in its audit entries, must be derived from the
  connection's actual network peer and from forwarding information added by
  reverse proxies the deployment has explicitly chosen to trust. No value a
  client sends may change that address, however it is formatted.
- The endpoints that exist only for the local machine must answer only requests
  whose actual network peer is that machine, even when trusted reverse-proxy
  handling is enabled.

## Contracts

- A refused request is answered with a client error (a 4xx response) and has no
  protected side effect.
- The web interface configuration has an integer `trusted_proxies` setting
  under the web interface section. It is the number of reverse-proxy hops in
  front of the web interface that the deployment trusts, and it defaults to 0
  (trust no proxy). With N trusted hops, only the address those N hops are
  responsible for is authoritative; anything a client puts further along the
  forwarding chain is not. A negative value is invalid and must prevent the web
  interface from starting.
- A request whose peer address cannot be determined is still throttled, under
  one fixed identity; it is not exempt.
- The existing per-client budget of 100 RPC API requests per minute is
  unchanged, and ordinary traffic below the budget is served normally.

## Keep working

These legitimate behaviours must be unchanged:

- Clients behind a reverse proxy that the deployment has configured as trusted
  keep their own per-client budgets and their own recorded addresses; distinct
  real clients do not collapse into one.
- A request coming from the machine itself still reaches the endpoints that are
  meant only for it.
- The web interface still writes the same authentication and access audit
  entries it writes today, including the client each one came from.
- Authenticated use of the web interface keeps working as it does today.

The examples above are examples, not the full set of cases.

## Constraints

- Fix the underlying problem and its close variants, not just the example
  trigger shown.
- Keep every legitimate use working.
- Do not special-case the example values.
- Do not look up the upstream fix for this issue.
