# Inherited object state

Feathers is a framework for building APIs and real-time services. It ships shared utility
helpers, data adapters and query handling that applications call directly and that services use
internally.

Observed impact: an application that combines a JSON request body into an existing object with
the framework's shared object-merge helper can be made to give every object in the process a
field it never declared. One request whose body contains a `__proto__` key is enough. Afterwards
a plain object created anywhere in the process reports the attacker's property, and any code that
reads that property sees the attacker's value.

## Required property

Data that a client or an upstream service supplies must never decide what any object inherits.
No key from that data may act as a prototype key: it must not change the shared prototype that
all objects inherit from, and it must not set the prototype of any object the framework builds,
returns or stores. This holds for a key at any depth and in any position, and however the data
arrives.

The framework's helpers and the services built on them are equally in scope, because an
application uses those helpers directly and services receive the same kind of data from callers.

A key that would do this is not honoured. The operation still completes for every other field,
and the result is otherwise the same as it is today.

These are invariants, not a list of cases. The example above is an example.

## Behaviour that must not change

Everything that works today keeps working exactly as today: ordinary nested data and ordinary
names keep their current behaviour, and data that merely uses an unusual name must not make a
whole operation fail.

There is no network access.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example above.
