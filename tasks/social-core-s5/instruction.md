# A stored sign-in flow can be continued by another browser session

Python Social Auth Core is a library that web applications use to sign people in through external
providers. A sign-in can pause partway so the application can collect something else from the
visitor; the library stores the halted flow and gives the application an identifier for it. When
the browser comes back to the completion endpoint, the application asks the library to continue the
stored flow.

Our application uses the library this way. A visitor who reaches the completion endpoint with the
identifier of a sign-in flow that was started in someone else's browser session is signed in as
that other account. The visitor's own session continues a flow it never started, which is a login
cross-site request forgery: the visitor is silently signed in to an account the attacker controls.

## Security invariant

A stored sign-in flow may be continued only by the browser session that started it, or, for a flow
the library itself set up to be completed from outside the starting session, by a request that
presents the proof that flow was set up to require. A session must not continue a stored flow it
did not start, whether the request supplies an identifier, a stored flow object, or any other
value. A refused request must not continue a stored flow, run any of its steps, consume it, or
sign anyone in.

## Refusal

A refused request gets a client error: the library's authentication error or a refusal response,
never a crash. It must not continue the stored flow, run any of its steps, or sign anyone in.

## What must keep working

Everything that works today keeps working exactly as it does today: ordinary sign-ins, a flow
continued by the browser session that started it, every way the library already accepts a flow's
identifier, and flows the library itself sets up to be completed outside the starting session,
including the proof such a flow requires.

The example above is an example, not the full set.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example.
