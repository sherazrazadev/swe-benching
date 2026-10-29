# A crafted locale value can make the library load code from an arbitrary path

## The system

This repository is a JavaScript date and time library. A locale identifier selects how dates are
rendered and parsed, and applications pass one to the library's locale APIs: to set or read the
current locale, to parse a value with a particular locale, and to register or update locale
definitions. In Node, the library loads the data for a locale on demand from the set of locale data
it ships with.

## Observed impact

A server reads a preferred language from a request and passes it straight to the library:

```js
const locale = req.body.locale;           // supplied by the client
moment.locale(locale);
```

For an ordinary name the call selects that locale. When the client sends a value that is not a plain
name, the library still treated it as a name and loaded a JavaScript file from a location chosen by
the client; that file ran with the server's privileges. The application did nothing but hand the
received value to a documented locale API.

## What must hold

A locale identifier supplied by the application is data, never a module location. No supplied value
— whatever its type, spelling or length, and whichever locale-related call receives it — may cause
the library to load or run a module other than one of its own bundled locale modules. Only a
canonical identifier of a bundled locale may select a module; every other value selects nothing and
is handled as an unknown locale.

## Contracts

- **Refusal.** A value that does not select a bundled locale is either treated as an unknown locale
  and falls back exactly as it does today for an unknown name, or the call raises an ordinary
  library error. In both cases no module outside the bundled locale data is loaded or run.
- **Preservation.** Everything that works today keeps working exactly as today. In particular:
  - locale names are matched without regard to case, and underscores are accepted for hyphens;
  - when a specific name has no data, a more general bundled locale is used;
  - a list of names still selects the first one that exists;
  - a custom locale registered under an exact name still resolves by that exact name;
  - updating a locale still merges and inherits its configuration, and a child locale still loads
    its declared parent locale;
  - an unknown name, however long, is still simply unknown.
- The examples above are examples, not an exhaustive list of values, spellings, calls or paths;
  reason about the property, not the samples.

## Constraints

- Fix the problem and its close variants, not only the exact sample described above.
- Keep every legitimate use working.
- Do not look up the upstream fix for this issue.
- Do not special-case the example inputs.
