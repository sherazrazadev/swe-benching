# oras-go-s5 — design notes (build-v1, pattern A, injected)

Start UTC: 2026-10-28T23:58:58Z
End UTC: 2026-10-29T00:21:00Z

## Candidate

`oras-project/oras-go` at `cc323e564d90c6b5b4bdd71d3c8d2ee2713b37e5` (direct parent of the
published fix `3c2e884e12ea52b6bff60c97f1edb7df7d0e0909`; the fix changes only
`registry/remote/auth/client.go` and adds tests there). Advisory GHSA-VH4V-2XQ2-G5CG /
GO-2026-5884. The published fix is three source changes in `auth.Client`:
(1) `send()` drops `Authorization` when a redirect crosses an origin (scheme/host/port,
default-port normalised, host case-folded); (2) after a 401, `Do()` refuses to resolve or
send credentials when the challenging response came from a different origin than the
originally requested URL; (3) `Do()` falls back to `URL.Host` when a caller-built request
has an empty `Host`.

## Security property (stated once, before routes)

> The registry credential belongs to the HTTP origin (scheme, host and port) the caller
> addressed. It may be sent there, and to the registry's own login/token service when — and
> only when — the origin the caller addressed designates that service (which may sit on a
> different public host). It must never be sent to any other origin, and a response that did
> not come from the addressed origin must never cause it to be resolved or transmitted at
> all.

Read literally this covers every route below:
- redirect after authentication to another port (the reported symptom): forbidden
  (other origin);
- redirect before authentication, whose 401 challenge names a realm on the redirect target
  or another host: the response came from a non-addressed origin, so no credential may be
  resolved or sent — including to the named realm;
- a server-named continuation endpoint for a blob upload (a `Location` on another port):
  another origin, so the credential may not follow;
- same-origin path redirect: allowed (same origin) and must keep working;
- the distribution bearer realm on a separate public host: allowed only because the
  addressed origin's own 401 designated it; this is the coupled legitimate value.

## Levers

One line each (pattern, shape, where, reason to dismiss):
- L1 (main, how-type; injected second implementation): redirect after authentication to another port — the HTTP wrapper's redirect callback re-adds the credential with a host-name-only check — `registry/remote/retry/client.go:27-47` interacting with `registry/remote/auth/client.go:136-165` — "transport wrapper, hostname check is enough".
- L2 (how-type; published far function): pre-auth redirect whose target's 401 names a bearer realm on a third origin; the credential for the addressed registry is posted there — `registry/remote/auth/client.go:251-262` — "redirects are stripped, cross-host realms are documented".
- L3 (where+shape; injected far file): chunked upload continuation `Location` on another origin receives the copied credential with no redirect involved — `registry/remote/repository.go:1013-1040` — "uploads are not redirects, the first Location was already checked".

L1 (MAIN, how-type; injected second implementation; far package `registry/remote/retry`).
`retry.NewClient` ships a `CheckRedirect` that re-adds `Authorization` after a redirect
that keeps the same host *name*. The published fix's wrapper deletes the header on an
origin change and then calls the preserved callback, which puts it back. A solver must
understand (a) `net/http` copies sensitive headers on a same-hostname redirect before the
callback runs, (b) `CheckRedirect` callbacks chain, (c) an origin is scheme+host+port, not a
hostname. Fixing only `auth.send` leaves the sink with the credential; fixing the retry
callback alone leaves `net/http`'s own copy in place. Both implementations must agree.
Reason to dismiss: the retry package is "just a transport wrapper", the auth client is
where redirects are handled, and the hostname comparison looks like it already restricts
the copy.
Sites: `registry/remote/retry/client.go:27-31` (injected callback), interacting with
`registry/remote/auth/client.go:136-141` (published).

L2 (how-type; published fix's far function, same file as the landing point).
A request is redirected *before* authentication. The redirect target answers 401 with a
`Bearer` challenge whose realm is on a third host. The client resolves the credential for
the originally addressed registry and posts username/password to the realm. The redirect
fix alone does nothing here because the realm request is a fresh direct request; only the
"challenge origin" check closes it. Reason to dismiss: redirects are already stripped, the
retried request goes back to the configured registry, and cross-host realms are documented
as legitimate (`validateRealm` deliberately permits them).
Site: `registry/remote/auth/client.go:251-262` (published), reached from :343-356/364-371.

L3 (where+shape; injected far file, different package `registry/remote`).
A chunked/resumable blob upload (advertised by `OCI-Chunk-Min-Length` on the upload session,
per the distribution spec) is added next to the existing monolithic upload. The first
`Location` is validated with the existing `sameUploadHost` helper; the *second* `Location`
returned by the chunk response is trusted and the copied `Authorization` is sent there. No
HTTP redirect is involved, so the auth-client fix cannot see it. The fix must validate the
continuation endpoint (or refuse). Reason to dismiss: uploads are not redirects, the first
`Location` is already checked, and the credential is "reused from our own upload request".
Site: `registry/remote/repository.go` (injected; adjacent to the published-unrelated
`sameUploadHost` code at :876-925).

Different reasons: L1 "transport wrapper / hostname is enough"; L2 "redirects are stripped /
cross-host realms are documented"; L3 "uploads are not redirects / the URL was already
checked". None of the three has its own sentence in the instruction.

## Input shapes covered

- same host, different port (origin change; the advisory's core shape);
- redirect before vs after authentication (two different phases of the same client);
- bearer challenge realm on another origin (credential travels as Basic to the token
  service / in the OAuth2 body);
- server-named upload continuation endpoint on another origin (no redirect primitive);
- cached-token request redirected across origins (token already attached before the
  redirect);
- coupled legitimate shapes: same-origin path redirect; cross-host token service named by
  the addressed origin; caller-supplied `CheckRedirect` still invoked; same-origin chunked
  upload; monolithic upload; anonymous bearer exchange.

## Full candidate list before picking

Real upstream (unmodified) candidates:
1. `auth/client.go:251-262` — 401 challenge from a redirected origin. Published fix site;
   chosen as L2 (far function from the reported redirect sink).
2. `auth/client.go:228-230` — empty `req.Host` fallback. Published fix site but a
   robustness fix, not a security protection: no behavioural test fails at the pin and
   passes only with it without also depending on a wildcard credential callback. Not used
   (recorded, not built on).
3. `repository.go:898-952` — monolithic blob-upload `Location` follow with a manual
   `Authorization` copy. Already protected by GHSA-jxpm-75mh-9fp7 (`sameUploadHost`,
   present at the pin). Used only as the realistic precedent for L3.
4. `utils.go:40-59` with call sites `repository.go:450,589`, `registry.go:180` —
   pagination continuation from a server-supplied absolute `Link`. Rejected: the next
   request is resolved by its own host, and `StaticCredential` only answers for the
   addressed registry, so no credential leaks through the real entry point.
5. `auth/cache.go:74-139` — token cache keyed by registry host. Rejected as a
   "producer off the check's path": `Do` itself calls `GetScheme`/`GetToken`, so a solver
   following the check reaches the producer immediately.
6. `auth/client.go:364-461` — realm token fetch posts the credential to a cross-host
   realm. Legitimate, documented behaviour (Docker Hub `auth.docker.io`); kept as a
   coupled functional value, never as a bug.
7. `registry/remote/credentials/*` — credential store keyed by server address. No path
   sends the caller's credential to a foreign origin; not a candidate.
8. `retry/client.go:27-31` — transport wrapper; no redirect logic upstream. Chosen as the
   location for L1.
9. O8b second `Location`-following upload step — chosen as L3.
10. O8b "redirect-aware wrapper in retry" — the same location as L1; merged into L1.

Injected siblings picked (2): L1 (retry callback) and L3 (chunked upload). L2 is the
published fix's own far site and costs no injection. L1 beat the other injected candidates
because its defect is behavioural (callback ordering + origin semantics, how-type) and it is
in a different package from both the report and the landing point. L3 beat a possible
second-retry-style sibling because it is a different concept (server-named continuation
endpoint, no redirect primitive) and lives in a different package again; a second
hostname-vs-origin copy would have been "more routes of one concept".

## Coupled must-keep-working behaviour (functional)

For each lever:
- L1: a same-origin path redirect still carries the credential and succeeds; a caller
  `CheckRedirect` on the underlying client is still invoked.
- L2: a 401 from the addressed origin naming a token service on a different public host
  still receives the credential and the exchange succeeds (Docker Hub pattern); an
  anonymous bearer exchange still succeeds.
- L3: a chunked upload whose continuation endpoint stays on the registry completes, with
  the credential on both the chunk and the final request; the monolithic upload still
  works.
Also the project's own tests for `registry/remote/auth`, `registry/remote/retry` and
`registry/remote` run as a functional group.

## Tests

Security (all must fail on pinned+injection):
S1 authenticated redirect to another port must not forward the credential (L1, retry client,
   Basic);
S2 the same with a cached bearer token attached before the redirect (L1 + cache path);
S3 pre-auth redirect, 401 Bearer realm on a third origin: the realm must not receive
   username/password and the redirect target must not receive the token (L2);
S4 pre-auth redirect, 401 Basic challenge: the redirect target must not receive the
   credential after the retry is redirected again (L2, second shape);
S5 chunked upload continuation `Location` on another origin must not receive the credential
   (L3).

Functional (all must pass on pinned+injection and after any correct fix):
F1 same-origin path redirect keeps the credential;
F2 cross-host token service named by the addressed origin receives it (Docker Hub pattern);
F3 caller-supplied `CheckRedirect` still invoked;
F4 chunked upload on one origin completes with the credential on chunk + final;
F5 monolithic upload still works;
F6 anonymous bearer exchange still works;
F7 project tests for the three packages.

## Wrong-fix patches

- `sf-published-only.patch` (security_fail): the published client.go fix only; L1 and L3
  still leak.
- `sf-no-retry.patch` (security_fail): oracle minus the retry callback fix; L1 leaks.
- `sf-no-challenge-origin.patch` (security_fail): oracle minus the 401 origin guard; L2
  leaks.
- `sf-no-upload-check.patch` (security_fail): oracle minus the chunked continuation check;
  L3 leaks.
- `sf-landing-only.patch` (security_fail, unlisted_route): drop the credential only in the
  single reported redirect, leaving the challenge and upload routes.
- `ff-overbroad-origin.patch` (functional_fail): strip the credential on every redirect;
  F1 fails.
- `ff-strict-host.patch` (functional_fail, adjacent_api): exact string host comparison that
  also refuses cross-host realms; F2 fails.
- `sf-crash.patch` (security_fail, crash_as_refusal): panic instead of a clean refusal.
- `sf-refuse-all.patch` (security_fail, refuse_all): refuse every outbound request on the
  protected path (F-tests fail too, but it is listed as the refuse_all catalogue entry).
- `pass-hardening.patch` (pass, hardening): oracle + a shared origin helper + defensive
  handling.
- `pass-alt.patch` (pass, alternative): enforce the origin rule in a RoundTripper wrapper
  instead of `CheckRedirect`, plus the same upload/challenge fixes.
- blind is written later by run_blindfix; not produced here.

## Risks / unknowns

- No upstream regression tests at the pin (verified with `git diff`); the fix adds tests
  only in `auth/client_test.go`.
- The empty-`Host` published site is a robustness change; no clean security test
  distinguishes it, so it is not a lever.
- Case-varied same-origin redirects lose the credential already at the pin (Go's
  `idnaASCII` does not lower-case ASCII hosts), so that shape is not a functional test; it
  would be a behaviour improvement, not a preserved contract.
- Default-port normalisation cannot be exercised through a real listener in the verifier
  (uid 1000 cannot bind 443/80); it is covered by the code's precedent and the exact
  oracle, not by a hidden test.
- Offline toolchain: `go.mod` requires go 1.25.0; base `golang:1.25-bookworm`, module and
  build caches warmed at image build.

Gate: static PASS. nop PASS (security 4/4 failed, functional 394/394 passed; the
functional count includes the project's own tests). oracle PASS 3/3, each run reward 1.0 with
identical results (security 4/4, functional 394/394). patches PASS 13/13:

| patch | declared | outcome |
|-------|----------|---------|
| sf-published-only | security_fail | 3 security fail, 0 functional fail |
| sf-landing-only | security_fail | 4 security fail, 0 functional fail |
| sf-no-retry | security_fail | 2 security fail (L1), 0 functional fail |
| sf-no-challenge-origin | security_fail | 1 security fail (L2), 0 functional fail |
| sf-no-upload-check | security_fail | 1 security fail (L3), 0 functional fail |
| sf-hostname-only | security_fail | 3 security fail, 0 functional fail |
| sf-wrong-location | security_fail | 1 security fail (L3), 0 functional fail |
| sf-crash | security_fail | 1 security fail, 0 functional fail |
| ff-overbroad-redirect | functional_fail | 1 functional fail (same-origin redirect) |
| ff-block-cross-host-realm | functional_fail | 24 functional fail (token service + project bearer tests) |
| ff-refuse-all | functional_fail | 106 functional fail |
| pass-alt-remove-retry | pass | reward 1.0 |
| pass-hardening | pass | reward 1.0 |

The blind pass patch (kind `blind`) is produced by the post-build blind-fix step and was not
written here, per the build instructions.

## Verification log

Local (scratch trees, Go 1.25 toolchain, offline after module warm):

| tree | security | functional |
|------|----------|------------|
| pinned + injection | 4/4 fail | 6/6 pass |
| reference fix | 4/4 pass | 6/6 pass |
| project tests (three packages) | - | pass on pinned+injection and on the fix |

Variant matrix (hidden suites only; project tests separately confirmed for injected and fix):

| patch | F1 | F2 | F3 | F6 | F4 | F5 | S1 | S2 | S3 | S4 |
|-------|----|----|----|----|----|----|----|----|----|----|
| injected | . | . | . | . | . | . | X | X | X | X |
| fix | . | . | . | . | . | . | . | . | . | . |
| sf-published-only | . | . | . | . | . | . | X | X | . | X |
| sf-landing-only | . | . | . | . | . | . | X | X | X | X |
| sf-no-retry | . | . | . | . | . | . | X | X | . | . |
| sf-no-challenge-origin | . | . | . | . | . | . | . | . | X | . |
| sf-no-upload-check | . | . | . | . | . | . | . | . | . | X |
| sf-hostname-only | . | . | . | . | . | . | X | X | X | . |
| sf-wrong-location | . | . | . | . | . | . | . | . | . | X |
| sf-crash | . | . | . | . | . | . | X | panic aborts the package | | . |
| ff-overbroad-redirect | X | . | . | . | . | . | . | . | . | . |
| ff-block-cross-host-realm | . | X | . | X | . | . | . | X | . | . |
| ff-refuse-all | X | X | X | X | X | X | . | X | . | . |
| pass-alt-remove-retry | . | . | . | . | . | . | . | . | . | . |
| pass-hardening | . | . | . | . | . | . | . | . | . | . |

`.` = pass, `X` = fail.

Gate: see the summary above (static PASS, nop PASS, oracle PASS 3/3, patches PASS 13/13).


