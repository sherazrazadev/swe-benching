# Authorization errors can redirect the browser to an unregistered callback

Authlib is a Python library for building OAuth 2.0 servers and clients. An application that uses the server integration exposes an authorization endpoint: a client sends the resource owner's browser there with its `client_id`, the response type it wants, and usually a `redirect_uri`; the server answers with a consent screen or a redirect back to the client's registered callback.

## Observed impact

A crafted authorization request makes the endpoint answer with a redirect to a URI that belongs to no registered client:

```
GET /oauth/authorize?response_type=totally-unsupported&client_id=known-client&redirect_uri=https%3A%2F%2Fattacker.invalid%2Flanding&state=abc
```

The server replies `302` with `Location: https://attacker.invalid/landing?error=...&state=abc`. A link to the trusted authorization server therefore bounces the visitor to an attacker's site with an OAuth error and the request's `state`. For contrast, the same request naming `https://known-client.invalid/callback`, a URI registered for that client, is legitimately answered at that callback.

## Required behaviour

- A redirect the authorization endpoint sends may only target a redirect URI that is registered for the client identified by that request. When the request names no redirect URI, the client's registered default URI may be used.
- If the request identifies no client known to the server, or names a redirect URI that is not registered for that client, the server must answer with a client error and must not redirect. Nothing else may be issued for such a request, such as an authorization code or a token.
- These rules hold for every authorization request the endpoint answers, whatever parameters it carries and however they are supplied.

The request above is one example, not the full set.

## Must keep working exactly as today

- A client that names one of its own registered redirect URIs still receives error responses at that URI exactly as today, including errors that are not about the redirect URI itself, and the response still carries the request's `state`.
- A client with several registered URIs may keep using any of them, not only its default.
- All successful authorization flows keep working exactly as today.
- Everything else the project does today keeps working exactly as today.

## Constraints

- Fix the problem and its close variants, not only the example.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example.
