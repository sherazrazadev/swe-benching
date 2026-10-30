# Sign-in state stored for one provider can finish another provider's sign-in

## The system

The project in `/workspace` is an authentication library for web applications. An application
configures one or more identity providers — OAuth 2.0 / OpenID Connect providers and
passkey-based providers. To sign a user in, the library sends the browser to the provider,
stores a little state in the browser so the returning callback can be matched to the sign-in
that started it, and finishes the sign-in when the provider sends the user back. The library
also lets a signed-in user add a second provider to their account by signing in with it.

## What we observed

An application is configured with two OAuth providers, `alpha` and `beta`. A browser starts a
sign-in with `alpha`; the library stores `alpha`'s sign-in state in the browser and sends the
browser to `alpha`. Without finishing that sign-in, the same browser requests the callback for
`beta` with a code and the state value it was given, and the library completes a full sign-in
for `beta` and issues a session. This is one example, not the whole problem.

## Required behaviour

- **Sign-in state is bound to the provider that stored it.** A value the library stores in the
  browser to carry an in-progress sign-in may be honoured only by a sign-in for the same
  identity provider that stored it. A value stored while signing in with one provider must never
  be accepted, applied or acted on when a request is for a different provider — whatever the
  value carries, and whichever part of the library reads it. A stored value that does not
  establish which provider stored it is treated the same way.
- **A refused request has no effect.** When a stored value is not accepted, no session is
  issued, no account is created or linked, and no value taken from that state is applied. The
  refusal is a clean client-facing error, not a server error or a crash.

## Preservation

Everything that works today keeps working exactly as today:

- Starting and finishing a sign-in with the same provider still signs the user in, including
  every value the provider and the library exchange during that flow.
- Registering and authenticating a passkey still works with the provider that issued the
  challenge.
- Adding a second provider to an account that is already signed in still works when the same
  provider that started the addition finishes it.
- Completing a sign-in from a request that legitimately carries no browser state still works:
  when another service forwards the provider's response to the application, that hop must not be
  made to require state it cannot hold.

Everything above is about behaviour, not spelling: the examples in this report are examples, not
the full set.

## Constraints

- Fix the problem in the library, not only the example above. Close the same kind of gap
  wherever sign-in state is stored and read, and do not special-case the example's provider ids,
  values or paths.
- Keep legitimate use working as described.
- Do not look up or copy an upstream fix for this issue.
