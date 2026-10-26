# A caller-chosen name can put data on an object's prototype

## The system

This repository is a small JavaScript library for nested object access. An application hands it a
name for a location inside a plain object — usually a dotted key, sometimes a list of path parts —
and the library reads, writes or reshapes nested values at that location. Applications use it on
data they do not control: per-user settings, stored JSON documents, request payloads. Both the
names and the values can be chosen by someone other than the application.

## Observed impact

A service builds a user's settings from a key/value map supplied by that user, then checks a field
on the result:

```js
const settings = {};
library.set(settings, userKey, userValue);
if (settings.isAdmin) { /* privileged path */ }
```

With the name `profile.__proto__.isAdmin` and the value `true`, the write completes. Afterwards
`settings.profile.isAdmin` reads as `true` even though nothing was stored for it and it is not one
of `profile`'s own fields: the caller's name replaced the prototype of the object the library
built. Code that reads fields without checking ownership accepts the injected value, so the user
gains a privilege the application never granted.

## What must hold

No caller-supplied key, path or part of one may reach, create or replace an object's prototype
chain. No operation may add, change or delete anything on a prototype, and no caller-supplied
value may become an object's prototype.

This is an invariant over the data, not a list of cases. It holds for every public operation that
accepts a caller-supplied key or path, wherever a dangerous name appears in it, and however the
caller supplies that name. The example above is one example.

## Contracts

- **Refusal.** A name that would violate the invariant is not acted on. It may be skipped or raise
  an ordinary library error; in either case nothing is written through it, the process keeps
  running, and every other key or record in the same call keeps exactly the result it has today.
- **Boundary.** A final name is ordinary data unless writing it would itself change a prototype.
  A field name that merely resembles a built-in object concept is still stored and returned as an
  ordinary own field when it is the value being stored.
- **Preservation.** Everything that works today keeps working exactly as today.
- The samples above are examples, not an exhaustive list of operations, names, shapes or
  positions.

## Constraints

- Fix the problem and its close variants, not just the exact sample described above.
- Keep every legitimate use working.
- Do not look up the upstream fix for this issue.
- Do not special-case the example inputs.
