# Asymmetric key material must never be a shared secret

## What this is

The project in `/workspace` is a Node.js JSON Web Token (JWT) library. A caller gives it
key material: a shared secret, or a PEM-encoded asymmetric key or X.509 certificate.
From that material the library decides which algorithms a token may use.

## Required behaviour

Key material that is an asymmetric key or a certificate must never be used as a shared
HMAC secret, and a token must never be accepted unless its signature was checked against
the configured material with an algorithm that material supports. This is a property of
the material itself.

Genuine key material must remain usable with the algorithms it supports; refusing what
the library can use is not an acceptable outcome. Where the library cannot use the
configured material it must refuse with a clear error: no token is accepted and none is
produced.

A caller who explicitly asks for an HMAC algorithm may still use any string as the shared
secret for that call, and that explicit choice is unchanged. All legitimate use that
works today keeps working exactly as today.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case particular inputs.
- There is no network access.
