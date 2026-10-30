# A client can choose a framework message header through its CloudEvent

The application is an Apache Camel integration that accepts CloudEvents over HTTP on its knative
endpoint. Each accepted event becomes a Camel message: the event's standard attributes and its
extension fields become message headers, the `data` field becomes the body, and the route then
processes the message. Some header names are reserved by the framework, which uses them internally to
drive how the message is processed - for example, to choose the name of a file that a route writes.

## Observed impact

A client posts an event whose body is a single JSON object with an extra field named `CamelFileName`.
The route that stores accepted events in a folder writes the event under the file name supplied by
the client instead of a name the application controls. Other reserved names supplied the same way are
applied too, so a client can steer parts of the processing that the application believes it controls.

## What must hold

A field name supplied by a client must never become a message header that the framework reserves for
itself. The framework reserves every header name that starts with `Camel`, in any capitalization, and
a client-supplied field with such a name must be ignored - whichever part of the request the client
uses to carry it. The event must still be delivered to the route and processed normally: only the
reserved field is discarded, and the request is not refused.

Everything that works today must keep working exactly as it does today. In particular, the event's
standard attributes still populate their usual headers, the declared data content type still becomes
the message content type, ordinary extension fields still become message headers, ordinary request
headers are still carried, and accepted events are still written where they are written today.

The example above is one example, not the full set.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working: ordinary extension fields, the standard event attributes and ordinary
  request headers must behave exactly as they do today.
- Do not look up the upstream fix or any existing implementation of it.
- Do not special-case the example.
- There is no network access.
