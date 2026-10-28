# A restricted user can watch containers outside their permitted set

## What the system is

This project is a web interface for Docker. One server can be joined to several Docker hosts and
shows their containers: names, images, labels, state, health, live CPU and memory samples, and
lifecycle changes. When authentication is enabled, each account can carry a container filter written
as labels. The filter defines the set of containers that account is permitted to see; the interface
is expected to show that account nothing else. Accounts without a filter are unrestricted.

## What was observed

An account whose filter permits only containers labelled `team=red` opens the live event feed in the
browser. Its own container's samples arrive, but so do CPU and memory samples for a second container
that does not carry `team=red` and that the account cannot see anywhere else in the interface. The
identifier and the telemetry of a container outside the account's permitted set therefore reach that
account.

## The property that must hold

No response the server sends to a caller may carry data about a container outside the set that caller
is permitted to see. This holds for every response, for every kind of container data, and however
that data is produced, stored or addressed.

## What the fix must honor

- **Refusal or omission.** If a request cannot be served without including data about a container
  outside the caller's permitted set, the server must refuse it with a client error and no side
  effect. A crash or a server error is not a refusal. Otherwise the server serves the request with
  the out-of-scope data left out.
- **Preservation.** Everything that works today keeps working exactly as today. A caller with no
  filter still sees every container. A caller permitted to see a container keeps receiving that
  container's live samples, lifecycle, health and update messages, including while the caller is
  connected and including when the container is on another joined host. The names and shapes of
  the feed's messages, the existing fields of responses, and the names of any exposed operations
  stay as they are today.
- **A legitimate magnitude next to an attack magnitude.** A caller permitted to see two containers
  receives both, and receives nothing about a third that is not permitted.

The example above is one instance, not the full set of ways the property can be violated.

## Constraints

- Fix the flaw and its close variants, not just the example.
- Keep every legitimate use working.
- Do not special-case the example values.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
