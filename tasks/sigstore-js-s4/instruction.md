# Registry credentials can be used for the wrong registry

## The system

The project is a JavaScript/TypeScript client library and command-line tool
for Sigstore. One feature attaches an attestation (a signed statement) to a
container image held in an OCI registry; another resolves an image's digest.
To authenticate, the tool reads the credentials a user has stored locally for
container registries and uses the credential stored for the image's registry.

## What we observed

A user whose stored configuration held credentials for `ghcr.io` and nothing
for `cr.io` attached an attestation to `cr.io/acme/app`. The tool
authenticated to `cr.io` with the user's `ghcr.io` username and password, so
the operator of `cr.io` received credentials issued for a different registry.
This is one example; it is not the whole problem.

## Required behaviour

- Credentials stored for one registry are bound to that registry. Whenever the
  tool authenticates on behalf of an image, it must use exactly the credential
  stored for that image's registry, and it must not use or present a
  credential stored for any other registry.
- If no credential is stored for the image's registry, the lookup fails with
  an error instead of substituting a credential stored for another registry.
- This holds for every credential the tool can obtain for a registry, and no
  matter how the registry is written in the stored entry or how the tool
  decides which registry a request is sent to.
- Everything that works today keeps working exactly as today: a stored
  credential that resolves for a registry today keeps resolving for that same
  registry, including a registry reached on a port and a registry the tool
  already recognises under more than one accepted name; credential-bearing
  headers and identity tokens keep being returned; and requests keep
  authenticating to the registry they are sent to.

## Constraints

- Fix the problem and its close variants, not only the example above. Do not
  special-case the example's image names or values.
- Keep legitimate use working as described.
- Do not look up or copy an upstream fix for this issue.
- There is no network access.
