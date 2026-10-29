# oras-go: registry credentials follow a redirect to another endpoint

oras-go is a Go library for storing and fetching OCI artifacts in container registries. A caller
supplies the client with a credential for a registry. The client authenticates every request it
makes on the caller's behalf, either by presenting the credential directly or by using it to
obtain a token.

## Observed impact

A registry that answers an authenticated request with a redirect can hand the caller's credential
to a different endpoint. With the library's default client, a registry listening on
`127.0.0.1:5000` and a second HTTP listener on another port: a request that the first registry
answered by redirecting to the second listener made the second listener receive the credential
that was configured for the first.

## Required behaviour

The registry credential belongs to the origin — scheme, host and port — that the caller
addressed. It may be sent to that origin, and to a different host only when the addressed
origin's own response designates that host for authentication. It must never be sent to any other
origin. A response that did not come from the addressed origin must never cause the credential to
be resolved or transmitted at all.

These must keep working exactly as they do today:

- a request redirected within the same origin — a different path on the same scheme, host and
  port — still completes with the credential;
- a different public host designated for authentication by the addressed origin still receives
  the credential and the exchange completes;
- caller customisations of the underlying HTTP client keep behaving as they do today;
- requests that need no credential, and the ordinary operations the library supports, still
  complete.

If an exchange cannot proceed without sending the credential to a forbidden origin, the client
must refuse it with an error instead of sending the credential. A refusal leaves the forbidden
endpoint without the credential.

The example above is an example, not the full set of affected places.

## Constraints

- Fix the reported problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or any existing implementation of it.
- Do not special-case the example.
- There is no network access.
