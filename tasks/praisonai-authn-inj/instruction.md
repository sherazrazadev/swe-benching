# Agent servers answer unauthenticated callers from other machines

## The system

PraisonAI runs several HTTP surfaces around one shared set of agents: a
telephony call server that answers voice calls and hands them to an audio
stream, a command that serves agents and their workflows over HTTP, and routes
used by external automation tools to drive agent workflows. Operators can
require a bearer credential or an API key, or they can turn authentication off
for local use.

## Observed impact

We started an agent server on an address reachable from our office network with
authentication turned off for local development. A colleague on another machine
could list our agents, invoke them, and remove registrations without presenting
any credential. A caller on another machine could also make the server believe
the request had come from the machine itself. Separately, the telephony webhook
answered calls even though no token had been configured for it.

## Security properties that must hold

- An authentication opt-out may take effect only when the server process is
  bound to a loopback address. The decision must come from the address the
  server is actually listening on, never from anything the client supplies, and
  a server that cannot establish its own bind address must refuse.
- Every route that can list, inspect, register, unregister, or run a registered
  agent must require proof of authority unless the opt-out above legitimately
  applies. This holds on every server that exposes such a route, on every bind
  address, and whether or not an optional credential has been configured.
- The telephony webhook, and the audio stream it starts, must never process a
  request unless the deployment has configured its token and the request
  presents it.

## Contracts the fix must honour

- A blocked request is answered with an error response (a 4xx or 5xx status, or
  a closed WebSocket) and has no effect: the agent does not run, and no
  registration is added or removed.
- Legitimate use keeps working exactly as today: on a genuine loopback bind the
  opt-out still lets local callers use the agent routes without a credential; a
  configured token or API key still grants access on any bind; the telephony
  webhook still answers with a stream URL that points back to the address the
  caller reached and carries the configured token; and the optional API-key
  protection still enforces its key on its protected paths.
- The credential forms the servers already accept keep working.

The examples above are illustrations, not the full set of routes or
configurations the properties cover.

## Constraints

- Fix the underlying problem and its close variants, not just the example.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
