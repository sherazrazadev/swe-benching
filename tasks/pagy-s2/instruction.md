# Pagy can be made to read locale data from outside its locale directories

Pagy is a pagination library for Ruby applications. It renders pagination controls, translates
their labels from locale files, and lets an application choose the language for a request. It
also generates HTML fragments that can carry display options supplied by the application.

## Impact

A request value used to choose the display language can make the library load a locale file from
a directory the application never configured. The strings from that file are then returned as
pagination labels.

## Required properties

No value supplied as a language name may make the library read or load a locale file from outside
the directory it is looking that language up in, however the value reaches the library.

No value supplied as an option or argument may end the HTML attribute or element it is placed in
within markup the library generates. The value must stay inside the place it was meant for.

## Contracts

- A language value that is not a well-formed language name is rejected. The library may fall back
  to the default language or raise `ArgumentError`; it must not raise an unrelated error and must
  not read a file.
- Passing `nil` is accepted and returns default-language output.
- A well-formed language name is kept as the selected language even when no locale file ships for
  it; translation then falls back to the default language.
- Well-formed language names that carry a region or script part keep resolving to the locale file
  that matches them.
- Display values that are legitimate still render. A value may be escaped, but it must still
  appear in the same place it appears today.
- Everything that works today keeps working exactly as today.
- These examples are examples, not the full set.

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example.
