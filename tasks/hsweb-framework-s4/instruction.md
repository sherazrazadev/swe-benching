# Authorization responses can be sent to an attacker-chosen site

hsweb-framework is a Java framework for building reactive web applications. Its OAuth2 authorization server lets a client application register a callback address. When a user approves access, the server hands the caller an address to return to, carrying the authorization code; the server also redeems authorization codes for access tokens.

## Observed impact

A user approved access for a legitimate client and was returned to an address the attacker chose, carrying the authorization code. The attacker's address began with the client's registered callback as a plain string - for example, a look-alike host whose name starts with the registered host - and the server treated it as the registered callback. The request needed no special privilege.

## Required invariant

No request may cause an authorization result - the authorization code, an access token, or an error response - to be delivered to a redirect target other than the callback registered for the requesting client. A code obtained for one callback may be exchanged for a token only by a request that presents the same callback that was used to obtain it. This holds for every way an authorization request or a code redemption can be made, for every response to such a request, and however the target address is expressed or supplied.

## Refusal

When a redirect target is not acceptable, the service must refuse cleanly: the caller receives a client error (a 4xx response), no authorization code or access token is issued, and the response contains no address derived from the target that was supplied.

## Must keep working

- Every redirect target the server accepts today for a client - an exactly matching callback, a callback with additional query parameters, a deeper path below the registered one, and a sub-path of a registered bare origin - must keep being accepted and must keep receiving the authorization result.
- A code redeemed with the same callback that was used to obtain it must keep yielding a token; when no callback is presented, the client's registered callback is the one in effect and must keep working.
- An authorization request that is otherwise valid must keep behaving as today.
- Everything that works today must keep working exactly as today.

## Notes

The examples above are examples, not the full set. Fix the problem and its close variants; do not special-case the examples. Do not look up the upstream advisory or fix. Keep the change confined to this repository. There is no network access. The project's dependencies are available locally; build with Maven's offline mode.
