# A social-login callback can sign a visitor in without proving the login started in their browser

## The system

The repository in `/workspace` is a library of social-login middleware for Hono web
applications. An application mounts one middleware per identity provider on a
route that serves both as the login entry point and as the provider's callback
address. Starting a login redirects the visitor to the provider and gives that
visitor's browser a `state` value to remember for the round trip. When the
provider sends the visitor back with an authorization `code`, the library checks
the returned `state`, exchanges the code for the visitor's account details, and
exposes the signed-in account to the application.

## What we observed

A request to the Google sign-in route carrying a valid authorization `code` but
no `state` value at all, and arriving from a browser that had never started a
login, was accepted: the code was exchanged and the application treated the
visitor as signed in. The account was whichever account had ordered that code,
not the visitor's. `GET /google?code=<code>` was enough.

## Required behaviour

A request may complete a social login only when it proves that it continues a
login that this browser started. The proof is the `state` value the library gave
to that browser when the login started: the request must present that same
value. The value the library gives to the browser at login start must be one it
generates itself or one the deployment configured; it must never be taken from
request input. A request that presents an unissued or different value, or no
value at all, is not proof, and such a request must not sign anyone in.

This holds for every provider the library supports, and for every way a request
can reach the account-completion step, however that request carries the data it
uses to identify the visitor.

## Contracts

- A request that is refused gets a client error (a 4xx response). It is refused
  before the library contacts the provider, and the application's own route does
  not run for it.
- Everything that works today keeps working exactly as today when the proof is
  present. In particular, a login still starts through any provider and still
  redirects to it, remembering the generated value for that browser, even when
  the entry request carries other query parameters; a callback that returns the
  matching value still completes and exposes the visitor's account; and a
  provider configured with a fixed `state` value still works end to end.
- The example above is one example, not the full set.

## Constraints

- Fix the problem and its close variants in the library itself.
- Keep legitimate use working as described above.
- Do not look up or copy an upstream fix for this issue.
- Do not special-case the example's provider, values or parameters.
