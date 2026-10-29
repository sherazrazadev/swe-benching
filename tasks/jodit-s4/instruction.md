# An untrusted configuration object can change every object on the page

Jodit is a JavaScript WYSIWYG editor that applications embed as a library. The application
creates an editor with an options object, may update the editor's global defaults, and registers
further settings through the library's public JavaScript API. Configuration is often parsed from
JSON the application did not author: tenant settings, content received from a server, or saved
preferences.

## Observed impact

An application passes such a JSON configuration to the editor's public configuration API. The
object contains a settings group named `__proto__`. The library accepts the group and writes the
properties it carries onto the prototype shared by all JavaScript objects. Afterwards every
object in the page, including objects owned by the host application, reports properties the
attacker chose.

```js
Jodit.configure(JSON.parse(untrustedConfigurationJson));
```

## Required behaviour

No value supplied by the application, parsed from data it processes, or handed to the library
through any of its public entry points may cause a property to be added to or changed on an
object that the caller did not supply and that the library does not own. This holds in particular
for the prototypes shared by all JavaScript objects.

When a value cannot be stored or merged without breaking that rule, the library may refuse it: it
may throw, or it may leave that value out. Refusing is acceptable; the forbidden result is the
change to the shared object.

Everything that works today keeps working exactly as today, including partial option objects
merging with the values they extend and values marked to replace rather than merge doing so.

The example above is an example, not the full set of inputs the fix must handle.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example.
