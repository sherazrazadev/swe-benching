# Sanitized HTML can turn inert text into live markup

The project is a PHP library that sanitizes HTML. An application declares which elements and
attributes are allowed, passes a fragment of user-supplied HTML to the sanitizer's `sanitize()`
call, and renders the returned string into a page. The configuration can also opt an element into
being returned without encoding, for content the application treats as markup-like text.

## Observed impact

A page had opted one element into unencoded output. A visitor submitted a fragment whose closing tag
carried a tab before its bracket. The returned string still contained a complete image element with
an event handler, and the browser executed the handler when the page rendered the sanitized result.
The visitor needed no other privilege.

## Required invariant

Sanitized output must re-parse in a browser to the same elements and attributes the sanitizer kept.
Any text the sanitizer treats as inert — including content inside an element that the configuration
returns without encoding — must never become a live element or attribute when a browser parses the
returned string. This holds for any input, for any element, and for such an element in any position
in the output.

In particular, no value of the input and no placement of an opted-in element may let a browser read
the returned bytes as markup that the sanitizer did not keep.

## Contracts

- Sanitization always returns a string; it does not throw for any input.
- An element that the configuration opts into unencoded output must still be returned unencoded when
  its content is legitimate. Everything that works today keeps working exactly as today.
- The allowed-element and allowed-attribute declarations keep binding: an element or attribute that
  is not declared must not appear in the rendered page.

The examples above are examples, not the full set. Fix the problem and its close variants; do not
special-case the examples. Do not look up the upstream advisory or fix. Keep the change confined to
this repository.

The project's dependencies are already installed in the workspace.
