# Tilt's local session answers requests that carry no credential

## What this is

Tilt is a development tool that runs a local session on a developer's machine.
The session exposes a web UI, an HTTP API for the session's data, a live update
stream that the UI uses for real-time updates, and a command-line client that
talks to the same session. The running session holds a per-user credential; it
gives that value to the developer's browser so the UI can make authorized
requests, and the local command-line tools use the same value.

## Observed problem

A client that was never given the session credential can read the session's
entire current view. For example, a plain request to `/api/view` on the running
session returns the full view to anyone who can reach the port, with no
credential at all. The same missing authorization lets such a client read other
session data and make the session act.

## Security property

Every request that reads or changes the state of a running session must be
authorized by that session's credential. A client that does not hold the
credential must not be able to read or change that state, and must not be able
to obtain any value that grants access to it. This holds however the request is
made and whatever the request asks for.

A request that declares an origin other than the one it was sent to must be
refused even when it holds the credential, because a web page served from
another origin attaches its own origin to the requests it makes.

A refused request must fail with a client error and must have no effect: no
state is read, no work is queued, no setting or argument is changed, and no
access value is handed out.

The session credential is the value the running session holds for this purpose.
Browsers receive it in the `Tilt-Token` cookie, and local tooling may present
the same value in the `X-Tilt-Token` request header.

## Keep working

Everything that works today must keep working exactly as today. In particular:

- The first visit to the web UI still succeeds and still delivers the session
  credential to the browser, and that credential authorizes the UI's next
  requests.
- A request that holds the credential and declares the address it was sent to
  still succeeds, and a request that holds the credential and declares no
  origin still succeeds.
- The product's own command-line tools keep working against a running session,
  including reading its state, asking it to act, and following its live
  updates.

The examples above are examples, not the full set of cases.

## Constraints

- Fix the underlying problem and its close variants, not just the one example
  shown.
- Keep every legitimate use working.
- Do not look up the upstream fix or an existing implementation of this change.
- Do not special-case the example values.
- There is no network access.
