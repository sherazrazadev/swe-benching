# URL-based policy rules decide on the wrong request

## System

Anubis is an HTTP bot-protection service for web sites. For every request it decides
whether to allow it, deny it, or ask the client to prove it is not a bot. The decision
comes from a policy: an ordered list of rules, each of which can match on the client's
network address, user agent, headers, or the URL of the request, and a matching rule's
action is what happens to the request. Operators use URL-based rules for access
control — for example, to deny every request to an administrative area, or to allow
public assets without a challenge.

Anubis can be deployed in two ways. It can sit in the request path and proxy the
client's traffic itself, so the request it evaluates is the client's request. Or it can
act as an authorization service: a fronting reverse proxy asks it about each request
with an internal call and uses the answer to admit or refuse that request. The
fronting proxy tells Anubis which request it is asking about.

## Observed impact

In an authorization-service deployment, an operator wrote a rule that denies every
request whose path is `/admin`. A client requested

    GET /admin?x=1

and the origin served the administrative area. The denial rule never fired, so a
request the operator meant to refuse was handled as if no rule matched it.

## Security property that must hold

A policy rule that decides on the URL of the client's request must be decided on the
URL the client actually requested — never on anything about the internal request
Anubis receives on the client's behalf. Whatever part of that URL a rule reads — the
host it names, the path, the parameters, or the whole URL — it must read the client's
value for that part.
If the client's URL matches a rule, that rule's action applies; if it does not, it must
not. This holds for every kind of policy rule that looks at the request URL.

## Contracts the fix must honor

- **Refusal.** A request that a rule denies is answered with the deployment's denial
  response (the access-denied page, returned with the deployment's configured deny
  status) and the origin is never asked to serve it. A denial must not turn into a
  server error.
- **Preservation.** A request Anubis receives directly, rather than from a fronting
  proxy, is judged on the URL it arrived with. A client cannot change which rule
  applies to such a request by adding forwarding information of its own, and every
  deployment that ignores forwarding information today keeps ignoring it.
- **Fallback.** When an authorization call carries no information about a client URL,
  the decision uses the URL the call actually has, exactly as it does today.
- **Legitimate use.** Rules keep matching exactly the requests they match today,
  requests that no rule matches keep reaching the origin, and a rule that grants a
  public path keeps granting it.

The example above is one instance, not the full set of ways the property can be
violated.

## Constraints

- Fix the flaw and its close variants, not just the request shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
