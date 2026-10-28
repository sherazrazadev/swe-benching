# Key material must never be used as a different kind of secret

## What this is

The project in `/workspace` is a Node.js library that handles JSON Web Tokens (JWT). A
caller supplies key material to the library: either a shared symmetric secret, or
asymmetric material (a key or a certificate). The library chooses the algorithms from that
material.

## What we observed

Material that was not a shared secret was nevertheless accepted as one. A token that nobody
holding the corresponding private key had signed was treated as authentic, and its claims
were handed back. This is one example, not the whole problem.

## Required behaviour

- Key material must be used only as what it actually is: asymmetric material must never be
  used as, or accepted in place of, a shared symmetric secret, and no token may be accepted
  or produced unless its signature was created and checked with an algorithm that the
  configured material genuinely supports.
- This is a property of the material itself.
- Genuine material must keep working with the algorithms it supports, whatever text
  accompanies it, rather than merely being refused.
- An application that explicitly chooses a symmetric algorithm may use any string material
  as the shared secret for that choice. That choice is unchanged, and it does not make the
  material a secret for any other use.
- A refusal is a clear error; no token is accepted and none is produced.
- Everything else that works today keeps working exactly as today, for every kind of
  material and every way it can be supplied.

These examples are examples, not a complete list of the ways the requirement can be
violated.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the examples.
- There is no network access.
