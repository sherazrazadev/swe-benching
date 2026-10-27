# Gateway calls can be pointed at internal addresses

## System

MLflow's AI Gateway lets an operator register provider credentials and route
completion requests through them. A gateway records where each provider is
reached; an invocation makes the server issue an outbound request to that
destination and relay the result to the caller.

## Observed impact

An authenticated user who can register gateway configuration can make the
gateway connect to an address of their choosing inside the deployment or on the
host. For example, registering provider configuration whose address is
`http://127.0.0.1:8080/v1`, creating an endpoint from it, and sending a chat
request to that endpoint makes the gateway open a connection to the local
service and relay its response.

## Security property that must hold

No value supplied by a user, and no value already stored for a gateway, that
determines where an outbound gateway request is sent — an address, a host, or
any part of either — may cause that request to reach a destination that is not
publicly routable. The rule applies whatever form the value takes and however
many values the destination is assembled from; private, loopback, link-local,
and unspecified destinations are not publicly routable.

It is refused when such a value is supplied (the configuration is not stored and
has no effect) and again before a connection is opened (the request is refused
and nothing is sent).

The example above is one instance, not the full set of ways the property can be
violated.

## Contracts the fix must honor

- **Refusal form.** A refused configuration or call is reported to the client as
  a client error and has no effect.
- **Preservation.** Everything that works today keeps working, apart from what
  this property forbids. A destination used only because the product ships it as
  a provider's built-in default, and that no user supplied, is not a value this
  property forbids and keeps working.
- **Error handling.** A refusal is a normal client error, not a crash, a hang, or
  a server error.

## Constraints

- Fix the flaw and its close variants, not just the request shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
