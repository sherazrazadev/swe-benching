# A sanitizer's element policy is skipped for some elements it keeps

## The system

This project is a DOM-only HTML sanitizer. An application hands it untrusted markup — a
string, or a live DOM subtree it wants cleaned in place — and receives HTML that is safe
to insert. Applications can register callbacks (hooks) that the sanitizer invokes while
it works; an element hook that the sanitizer runs once it has processed an element is the
usual place to enforce an application policy, such as removing a private bookkeeping
attribute or dropping an element the application never renders.

## Observed problem

A service registers such an element hook that removes a private bookkeeping attribute
from every element before the result is rendered, and configures the sanitizer to
preserve user-defined elements whose names match a pattern the service trusts. An
attacker submits markup containing an element whose name matches that pattern and that
carries the bookkeeping attribute. The call returns; ordinary elements in the same result
have lost the attribute, but the attacker's element keeps it. The hook never saw that
element, so the application policy was silently not applied to it. The same happens when
the hook is meant to drop the element entirely.

## Required property

Every element the sanitizer does not remove must have been passed to the application's
element hook before the call returns. It must not matter how that element came to be
kept — an element that would not be allowed on its own but which the configuration
permits is treated exactly like an ordinary allowed element — which input form the caller
used, or where in the result the element sits. Conversely, an element the sanitizer
removes must not be passed to the hook. The hook's effect is part of the property: an
element the hook drops must not remain, and an attribute it removes must not be present
on any element that survives.

The example above is one instance, not the whole set of cases the property covers.

## Contracts

- The hook runs once for each element that survives, and not at all for an element the
  sanitizer removes.
- Everything that works today keeps working exactly as today: elements the configuration
  permits are still preserved, with their content and with their attributes sanitized as
  before; elements it does not permit are still removed; the sanitizer's existing
  treatment of markup, attributes and unsafe content is unchanged.
- Fix the reported problem and its close variants in this repository. Do not consult any
  upstream fix, advisory or changelog for this project, and do not special-case the
  example.
