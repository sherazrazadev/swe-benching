# Reject signatures whose signing time is not actually established

## The system

This project is a Java library and command-line tool for signing and verifying
software artifacts with Sigstore's keyless signing flow. Signing produces a
**bundle**: the artifact's signature, the short-lived signing certificate issued
by Fulcio, an entry in a public transparency log that records the signature, and
optionally RFC 3161 timestamp tokens. Verifying a bundle against a trusted root
decides whether the artifact's signature should be trusted, which includes
deciding that the signing certificate was valid when the signature was made.

Verification is available through the library's public API and through the
`sigstore-cli verify` command. Both are offline when given a local trusted root.

## Observed problem

Verification reports success for a bundle whose signing certificate had already
expired when the transparency log recorded the signature.

Concretely, a user runs:

```
sigstore-cli verify --trusted-root trusted-root.json --bundle bundle.sigstore artifact.txt
```

and the command exits successfully. The bundle's log entry claims a time that
is after the end of the certificate's validity window, and the certificate had
expired before that claimed time. The tool nevertheless treats the signature as
having been made while the certificate was valid.

## Security property (invariant)

No verification path in this project may accept a signature as having been made
while its signing certificate was valid unless the time used for that judgement
is authenticated by proof that the verification actually checked:

- a trusted transparency log's signature over that exact entry time; or
- a timestamp token over the signature that verifies against a trusted timestamp
  authority, whose generation time falls inside the certificate's validity.

A time value that the input merely carries is not authentication. That includes a
log signature field that is absent, empty, or one that the verification did not
check: none of these establish the time. If no authenticated time is available,
verification must fail. If the authenticated time lies outside the certificate's
validity, verification must fail. A claimed time that is inside the certificate's
validity is legitimate and must verify.

## What keeps working

Everything that works today must keep working exactly as today, including:

- a signature whose time is authenticated by a verified log signature, even
  though the certificate has since expired;
- a signature whose time is established only by a timestamp token that verifies
  against a trusted timestamp authority, even though the log entry carries no
  log signature;
- a signature that carries both an authenticated log-signature time and a
  verified timestamp;
- the public verification entry points, their names and signatures, and the
  bundle and entry types they accept, in their current shapes.

## Refusal contract

A refused verification is an error result: the operation throws or otherwise
reports failure and returns no success result. It must not silently return a
bundle, an object or a status that callers read as verified.

These examples are examples, not the full set of affected inputs or paths.

## Constraints

- Fix the underlying problem and its close variants, not just the exact example.
- Keep every legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the example inputs.
- There is no network access.
