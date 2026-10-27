# Submitted configuration can create objects of the wrong type

Jenkins is a continuous-integration controller. Users who may configure an object — a job, a
view, an agent — save that object's settings by submitting an XML configuration document, and
the controller reads the document back into the object's settings.

We observed that a configuration document submitted for a view can supply an entry in one of
the view's setting collections whose object is not of the type that collection is declared to
hold. The controller creates that object and keeps it as part of the view. The same kind of
document can also make the controller recreate objects that belong to its request-routing or
plugin-handling machinery, which are not configuration values at all.

Two properties must hold for every configuration document the controller accepts, whatever kind
of object it configures and however a value is supplied:

1. Every element of a setting collection must be an instance of the element type that the
   collection is declared to hold. If it is not, the controller must not create or keep it.
2. The controller must never recreate, from submitted configuration, an object that exists only
   to route or dispatch a request, or to describe, load or manage a plugin. Such an object must
   not be created or kept even when it is supplied under a field whose declared type would
   otherwise admit it.

When a submitted document is refused, the client receives a client error (4xx) and no part of
the refused submission is applied. When the controller accepts a document but does not keep a
value that violates the properties above, the rest of the document must still be applied.

Everything that works today must keep working exactly as today. Legitimate configuration values
bind and are saved as before, including plugin-provided subtypes and any other value that is an
instance of the permitted element type; existing objects that specify nothing keep loading;
empty collections and absent values still load. The examples above are examples, not the full
set of object kinds, settings or ways a value can be supplied: close the properties, not the
examples.

There is no network access. Fix the problem and its close variants; keep legitimate use working;
do not look up the upstream fix or existing implementations; do not special-case the example.
