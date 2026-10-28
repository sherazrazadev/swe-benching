# A public key must never be a signing secret

## What this is

The project in `/workspace` is a Node.js library for signing and verifying JSON Web
Tokens (JWT). A caller gives it key material: a shared secret for the HMAC algorithms, or
a PEM-encoded asymmetric key or X.509 certificate for RSA, ECDSA and EdDSA. The library
decides from that material which algorithms a token may use. Applications commonly keep
PEM material in files that carry a comment or header line above the
`-----BEGIN ...-----` block.

## What we observed

An application configured the library to verify tokens with an RSA public key that had
been loaded from a file beginning with a comment line. The library accepted a token whose
signature was an HMAC-SHA256 computed with that public key text as the shared secret, and
returned the token's claims. Nobody holding the private key had signed it. This is one
example, not the whole problem.

## Required behaviour

- Key material that is an asymmetric key or a certificate must never be used as a shared
  HMAC secret, and a token must never be accepted unless its signature was checked
  against the configured material with an algorithm that material supports. This is a
  property of the material itself, not of the text around it, the operation that uses it,
  the way it is supplied, or what the library has already done with it.
- Text around a genuine key or certificate does not change what it is: a key stored below
  a comment or header line must still be usable with the algorithms it supports, not
  merely refused.
- A refusal is a clear error; no token is accepted and none is produced.
- A caller that explicitly restricts an operation to HMAC algorithms may still use any
  string as the shared secret for that operation. That explicit choice is unchanged.
- Everything that works today keeps working exactly as today: shared secrets of any
  length, PEM-encoded public and private keys of every supported type, certificates, keys
  supplied directly or fetched for each token, and signing with a private key.

These examples are examples, not a complete list of the ways the requirement can be
violated.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the examples.
- There is no network access.
