# authlib-s4 — build notes

- Start (UTC): 2026-10-29T05:14:46Z (recorded by the build runner)
- End (UTC): 2026-10-29T05:40:20Z
- Advisory: GHSA-W8P2-R796-3VMQ / CVE-2026-41479 / PYSEC-2026-2119 (authlib/authlib)
- Pinned: 9266eaa2227ad7e21dc731b2a4a01909aabd934b (release 1.6.9); published fix 3be08468
- Track: injected; pattern: B; task root: `tasks/authlib-s4`

## Plan (written before the build)

Property, stated once: an authorization-endpoint response may only redirect to a
redirect URI registered for the client identified by that request (or that client's
registered default when none is named); unknown clients and unregistered URIs get a
client error and no redirect, whatever parameters the request carries and however
they are supplied.

Levers (each with a different reason to dismiss):

1. **T1 — real uncovered routes (main, how-type).**
   `authlib/oidc/core/grants/implicit.py:84-90` and
   `authlib/oidc/core/grants/hybrid.py:51-57`: the missing-`openid`-scope
   `InvalidScopeError` carries `request.payload.redirect_uri` before the client is
   resolved or the URI validated. Dismissal: different spec, different error code,
   looks like scope validation, lives in the OpenID Connect package. Confirmed
   reachable on the pinned tree (302 to an attacker URI, even with no client_id) and
   confirmed real by the later upstream commit 9babc131, which fixes exactly these
   two sites separately from the published fix.

2. **T2 — injected sibling (merged rewritten request, how-type).**
   `authlib/oauth2/rfc9101/authorization_server.py:74,78-89`: a maintainer-plausible
   RFC 9101 consistency check raises with the request-object `redirect_uri` claim,
   inside a `before_get_authorization_grant` hook, before the grant lookup can
   validate anything. Dismissal: an optional JWT-secured-request extension that
   rewrites the request first, so the reported decision point looks like it covers it.

3. **T3 — injected sibling (multi-valued input shape, how-type).**
   `authlib/oauth2/rfc6749/grants/base.py:145-150`: the shared repeated-parameter
   guard reports the error at `request.payload.redirect_uri`, which for a repeated
   parameter is only the first value. Dismissal: input hygiene for malformed
   requests, not a redirect decision.

4. **T0 — the reported landing point** (kept as the baseline trap):
   `authlib/oauth2/rfc6749/authorization_server.py:244-248`.

Coupled must-keep-working values: a client that names a registered URI still gets
the error response there (unsupported response type, unauthorized client, missing
openid scope, including a non-default second URI); every successful code, implicit,
hybrid and request-object flow is unchanged. An over-broad "never redirect" fix is
therefore caught.

### Candidate list (all sibling/route sites found) and why the picks won

Real sites at the pinned commit that build an error redirect:

- `authorization_server.py:244-248` — reported landing point (published fix).
- `oidc/core/grants/implicit.py:84-90` — **picked as T1**.
- `oidc/core/grants/hybrid.py:51-57` — **picked as T1** (same lever: the OpenID
  Connect grant family; two routes of one concept, tested together).
- `oidc/core/grants/implicit.py:176-180` (`process_implicit_token`, alg=none) —
  rejected: reached only after `validate_authorization_request` returns a validated
  URI, so the raw value equals the validated one.
- `oauth1/rfc5849/authorization_server.py:155-164` — rejected: OAuth 1.0, a
  different protocol outside this advisory's protection (noted only).
- `oauth2/rfc9101/authorization_server.py` existing errors — rejected: none attaches
  a redirect target at the pinned commit; kept as an injection site.
- `oidc/core/grants/util.py` prompt/login-required errors — rejected: they already
  receive the validated URI.

Injected-sibling candidates considered:

- RFC 9101 request-object consistency error — **picked (T2)**: how-type (merged
  payload produced by a pre-grant hook), far (different package and spec), plausible
  maintainer code, different dismissal reason.
- Repeated-parameter guard reports the first value — **picked (T3)**: shape trap in
  shared base code, a different dismissal reason (input hygiene), and findable by a
  bare grep for redirect targets in error construction.
- Early `response_mode` validation in the core implicit grant — rejected: less
  plausible for the core grant and just another copy of the same "early check" idea.
- A second redirect resolver in the SQLAlchemy client mixin — rejected: no natural
  call site; wiring one would be contrived rather than maintainer-plausible.
- An early "scope required" check in the core implicit grant — rejected: RFC 6749
  makes scope optional, so it would break legitimate requests and the project tests.
- A Django/Flask payload merge tweak — rejected: no error sink reaches it.

## What was verified

- Both real OpenID Connect routes reproduce on the pinned+injected tree: implicit
  and hybrid with `scope=profile` and an unregistered `redirect_uri` answer 302 to
  that URI; implicit does so even with no `client_id`. Read-only confirmation that
  upstream commit 9babc131 (2026-05-02) later fixed these two sites.
- The reported route reproduces with a known, unknown and absent client and with
  another client's registered URI.
- Both injected siblings reproduce: the signed request-object mismatch answers 302
  to the claim URI; a repeated `redirect_uri` with the unregistered value first
  answers 302 to the first value.
- Local pytest on generated trees: nop (pinned+injected) security 0/11 (all fail),
  functional 11/11 pass; oracle 11/11 + 11/11; the nine check patches behave as
  declared (sf-miss-main 4 security fail, sf-miss-oidc 5, sf-miss-request-object 1,
  sf-miss-repeated 1, sf-crash 4 errors, sf-missing-authority 2, ff-overbroad 5
  functional fail, pass-hardening 22/22, pass-alt-central 22/22).
- Project tests: `tests/flask/test_oauth2` 232 passed, 1 skipped on the
  pinned+injected tree and under the oracle.
- Gate stages: see "Gate" below.

## What could not be verified

- Whether upstream published a separate advisory for the later OpenID Connect fix;
  only the public fix commit 9babc131 was read (the register says so).
- Whether `present_in_latest` should read "route still present" or "flaw still
  present": the route is still in current upstream code but now uses the validated
  URI, so the register records `no` and the note explains it.
- The screenshots/screener claims about repository size were not needed; no size
  red flag.

## Gate

- static: PASSED (only the downstream blind patch and FAIRNESS.md remain, by design).
- nop attempt 1: verifier bug in my copy of `test.sh` — `run_group` was called with a
  group tag but the template function took two arguments, so it ran `env hidden`.
  Fixed by giving `run_group` the `<group> <tag> <command>` signature. The trial was
  classified infra; nothing about the task was learned from it.
- nop attempt 2: security 11/11 failed as required and functional 244 collected, but
  one unrelated project test (`rfc9068/test_token_generation.py:...no_user`, an
  unconditional skip) counted as not-passed by score.py. Excluded the unrelated
  `tests/flask/test_oauth2/rfc9068` subdirectory from the project group (203 pass,
  0 skipped locally).
- nop attempt 3: PASSED. security 11/11 failed on the vulnerable tree; functional
  214/214 passed (11 hidden + 203 project, `rfc9068` excluded).
- oracle: PASSED, 3 parallel runs all at reward 1.0 with identical results.
- patches attempt 1: sf-crash (crash_as_refusal) also crashed on an unknown-client
  request without a redirect URI, which the project test `test_authorization_none_grant`
  pins as a 400 body, so a functional test failed. Narrowed the crash to a named-but-
  rejected redirect URI; the project suite then passed and only two security tests failed.
- patches attempt 2: PASSED, 9/9 as declared (6 security_fail with all functional
  passing; ff-overbroad functional_fail with 24 functional failures; hardening and
  central-alternative pass at reward 1.0).

All four stages therefore pass individually: static, nop, oracle, patches.


## Outside the scope (noted only)

- `authlib/oauth1/rfc5849/authorization_server.py:155-164` redirects to the OAuth
  1.0 callback stored at temporary-credential time without re-validating it — the
  same class in a different protocol, outside this advisory; not built on.
- The later upstream test `test_missing_scope_empty_default` in the published fix
  commit has no matching source change; ignored.
