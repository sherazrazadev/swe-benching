# Another user can take over a chat session by presenting its identifier

## System

Chainlit is a framework for building conversational AI applications. Each browser
tab or API client gets a server-side chat session that holds the conversation
state, the user's per-session settings, and the per-user environment values the
client supplied. The client keeps a session identifier and sends it back when it
reconnects, so a reload or a network interruption continues the same
conversation. A deployment either requires users to log in, in which case the
server knows who is calling, or runs open with no accounts, in which case
sessions have no owner.

## Observed impact

A logged-in user can take over another user's chat session. A client that
presents an identifier belonging to a different logged-in account is bound to
that account's session: it receives the session's streamed output, and its
messages run with the victim's session state and the per-user environment values
the victim supplied. The victim's own connection is displaced. For example, one
authenticated user who presents another authenticated user's session identifier
continues that session instead of being refused.

## Security properties that must hold

- A chat session belongs to the user who created it. A request may not resume a
  session, bind a session to a new connection, or cause the application to act
  in a session, unless the request is authenticated as that session's owner.
- A session created in a deployment without login has no owner. A session with
  no owner may be used by an unauthenticated request, and only by one.
- A request that is not allowed is refused with a client error before it has any
  effect: the session is not rebound, not changed, and nothing the application
  would run on that session's behalf happens.
- These properties hold however a request carries the session identifier, and
  however the caller was authenticated.

## Contracts the fix must honor

- **Identity.** A session's owner is the account that created it. The same
  account may be represented by different objects on different connections;
  that does not change who owns the session.
- **Preservation.** A logged-in user reconnecting to their own session keeps
  working exactly as today, including when a different object represents the
  same account. An unauthenticated client reconnecting to a session that has no
  owner keeps working exactly as today. A connection that presents an identifier
  naming no live session still creates a fresh session, as it does today.
- **Refusal form.** A refused connection is rejected the way the product already
  rejects a connection it will not accept; a refused HTTP request returns a 4xx
  client error. Neither changes the session.

The example above is one instance, not the full set of ways the properties can
be violated.

## Constraints

- Fix the flaw and its close variants, not just the connection shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
