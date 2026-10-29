# The history page runs values taken from an application's event log

## The system
This repository is Apache Spark. Its history server keeps a browsable page listing the applications
whose event logs it has indexed: one row for each run of an application, with details about that
run. The server derives those details from event-log records, and the page draws the list in the
browser with a client-side table component. Anyone who can place an event log where the server
reads it, or run an application whose log the server indexes, chooses what those records contain.

## Observed impact
A person submits an application whose name contains HTML markup. Its event log is indexed, and when
anyone opens the history page that name is inserted into the page as live markup. The log author's
script then runs in the viewer's browser with the history server's origin, where it can read and
change the page and act with the viewer's session. A harmless way to observe it: give the
application a name containing an element that would load a resource from an address the history
page would never normally contact.

## What must hold
For every application and run the history server lists:

- No value taken from an application's event-log record may be interpreted as markup by the history
  page. Each such value must appear as the literal text it is, and no element or attribute it
  carries may take effect.
- Displaying such a value is ordinary: it must not raise an error or fail the page, and a value
  must not be silently dropped or rewritten.

The example above is one way the flaw appears, not an exhaustive list; reason about the property,
not the sample.

## Contracts
- Everything that works today keeps working exactly as it does today: for ordinary applications the
  page shows the same text, keeps the same interactions and the same order.

## Constraints
- Fix the problem and its close variants, not just the exact sample above.
- Keep every legitimate use working.
- Do not look up the upstream fix for this issue.
- Do not special-case the example inputs.
