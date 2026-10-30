# hsweb-framework-s4 build notes

- Start (UTC): 2026-10-29T12:54:12Z
- End (UTC): 2026-10-29T13:29:12Z
- Task: `hsweb-framework-s4` (pattern A, injected track), repo `hs-web/hsweb-framework`
- Pinned (vulnerable) commit: `3843e1bbb4799f34c372e07fc35117199f6c6376`
- Published fix: `c2882679a9125cea52678151af5ae213cbd52579` ("fix(oauth2): repair redirect_uri validation bypass")

## Security property (written once, before choosing routes)

No request may cause an authorization result - the authorization code, an access token, or an error
response - to be delivered to a redirect target other than the callback registered for the
requesting client. A code obtained for one callback may be exchanged for a token only by a request
that presents the same callback that was used to obtain it. This holds for every way an
authorization request or a code redemption can be made and however the target is expressed or
supplied.

Every route, site, shape and injected sibling below falls under that one sentence as written; none
of them is described in `instruction.md`.

## Design (levers, one line each)

1. **L1 (main, how-type: producer off the check's path + code/callback binding).** The token
   exchange (`/oauth2/token`, both GET and POST) never binds the code to the redirect target used to
   obtain it; the value is not recorded when the code is issued (the serialized code cache has no
   such field). The redemption check therefore depends on data produced on the authorization path
   and stored in the serialized cache; the check does not call that producer. Reason to dismiss:
   "the report is an open redirect on the authorization endpoint; the token endpoint already binds
   the code to the client and redirects nothing". Security tests: redeem with a different but
   individually-acceptable target, and redeem with no target after a non-default target was used.
2. **L2 (how-type: shape a plausible check mishandles).** The target comparison must compare
   endpoint components, not string prefixes: a look-alike host that begins with the registered host,
   a user-info authority whose string begins with the registered origin, a longer path that begins
   with the registered path, a fragment, and a different port. Reason to dismiss: "the obvious fix is
   string equality / a host-prefix check", which either over-blocks (L3) or misses a shape.
   Security tests cover the prefix-passing shapes that really work on the pinned code.
3. **L3 (coupled must-keep-working).** Compatible variants that the product accepts today must keep
   being accepted: extra query parameters on the registered callback, a deeper path below it, and a
   sub-path of a registered bare origin. Reason to dismiss: exact equality reads as the correct
   fix. Coupled functional tests.
4. **L4 (injected sibling, route where the protection never existed).** A legacy authorization
   mapping kept for old clients returns the redirect target without validating it. Reason to
   dismiss: "legacy/deprecated mapping, not the documented endpoint". Security test hits it over
   HTTP; functional test keeps the legacy mapping working with a legitimate callback.
5. **L5 (injected sibling, route where the protection never existed: the error path).** The
   authorization endpoint's error path returns the supplied target as an error redirect without
   validating it, including when the request was refused. Reason to dismiss: "error responses carry
   no code/token". Security test: a plainly foreign target is supplied, the request is refused, and
   the refusal must not carry the target.

Not an injected lever because it already exists upstream and the published fix covers it: the
compatible matching variants (L3) and the shape comparison (L2) are the published fix's own
behaviour; they are kept because they separate a prefix fix from a component-aware fix.

## Injected-sibling candidate list (all found before choosing)

1. Implicit/`response_type=token` authorization handler. **Dropped:** no implicit grant exists at
   the pinned commit (`GrantType.implicit` is only a constant, no granter), so the injection would
   invent a whole token-issuing flow and add an `AccessTokenManager` field plus wiring - a bigger,
   more visible change than a maintainer would leave.
2. Legacy authorization mapping for old clients that skips validation. **Picked (L4).** A second
   evaluation site, reachable over HTTP, no constructor change, and the upstream fix never touches
   it.
3. Authorization error redirect to the supplied target. **Picked (L5).** A real sink on the refusal
   path; the upstream fix only changes the success path, so reproducing it leaves the error sink.
4. Legacy `callback_uri` parameter alias used after validation. **Dropped:** the published fix
   rewrites exactly the `buildRedirect(...)` call that would carry the alias, so a solver
   reproducing the upstream change would remove the alias by accident; the lever would not be
   independent.
5. Programmatic `requestCode` without validation (screener O8). **Dropped:** it returns the code to
   a trusted caller and never delivers a response to a target; the token-exchange binding (L1)
   already covers the code redemption.
6. A second, configuration-backed `OAuth2ClientManager`. **Dropped:** the authorization endpoint
   validates against whatever client the manager returns, so a second client source creates no
   missing check.
7. Normalising/validating `callbackUri` in the entity-to-client mapper (screener O7). **Dropped:**
   the value is administratively stored; no plausible normalisation turns it into an
   attacker-chosen cross-origin target, and the mapper is a producer with no request input.
8. Decoding/normalising the redirect target inside `buildRedirect` after validation (ordering).
   **Dropped:** a constructed shape with no realistic exploit (decoding a same-host path does not
   change the host).
9. A second authorization-code cache implementation (in-memory fallback). **Dropped:** none exists,
   and any injected one would sit in the files the fix itself edits.
10. A legacy `authorization_code` parameter alias at the token endpoint. **Dropped:** the binding
    still runs on the cached value, so the alias does not bypass it.
11. Refresh-token and client-credentials grants. **Dropped:** no redirect target.
12. The client CRUD controller / entity. **Dropped:** it stores a callback but never redirects, and
    the value is administratively supplied.
13. The global response wrapper. **Dropped:** not a redirect sink.
14. `state` used as a return target. **Dropped:** no such product feature; implausible.
15. The public single-argument `validateRedirectUri` API defaulting to compatible mode. **Dropped:**
    not a sink by itself; every tested route goes through the controller.
16. A second transport/controller for authorization. **Dropped:** none exists; inventing one is not
    maintainer code.

Why L4 and L5 beat the rest: both are separate evaluation sites reachable through the real HTTP
endpoints, neither is touched by the published fix, both are covered by the one general property
without a sentence of their own, and each has a different plausible dismissal (a legacy mapping; an
error-only response). Candidates 1 and 4 were the closest but are either too large an invented flow
or not independent of the upstream hunk; 5-16 lack a real sink or attacker influence.

## Sites, routes, input shapes the security tests cover

- Authorization endpoint (`GET /oauth2/authorize?response_type=code`): look-alike host, user-info
  authority, longer path, fragment, different port (all of which the pinned string-prefix check
  accepts).
- Token endpoint (GET and POST `/oauth2/token`, `grant_type=authorization_code`): a different
  acceptable target after a code was issued for another; no target after a non-default target was
  used.
- Legacy authorization mapping (injected): the same look-alike/foreign targets, refused there too.
- Error path (injected): a foreign target on a request that is refused must not be returned at all.

## Coupled must-keep-working behaviour (functional tests)

- Exact callback, extra query parameters, deeper path, and sub-path of a registered bare origin.
- Token exchange with the same target used at authorization; and with the registered default when
  no target was supplied at authorization.
- The legacy mapping still works for a legitimate callback.

## Plan for oracle and wrong-fix patches

- `solution/fix.patch`: the published source fix (validation, mode property, wiring, cache field,
  token accessor, granter binding, controller) plus fixes for the two injected siblings (validate
  in the legacy mapping; stop redirecting on the error path).
- `checks/`: `sec_fail_shape` (oracle with prefix matching restored), `sec_fail_binding` (oracle
  without the redemption binding/cache producer), `sec_fail_get_only` (binding only on the GET
  token path), `sec_fail_legacy` (oracle but the legacy mapping unvalidated), `sec_fail_error`
  (oracle but the error redirect restored), `sec_fail_malformed` (parse failures accepted),
  `sec_fail_crash` (malformed input throws an unhandled failure instead of a clean refusal),
  `func_fail_exact` (exact-equality validation), `func_fail_refuse_all` (authorization always
  refuses), `pass_alternative` (a different complete design), `pass_hardening` (oracle plus
  defensive hardening of the product code the tests touch).

## What was verified

- The flaw reproduces through the product's real HTTP entry points at the pinned + injected
  baseline: driving the product's own WebFlux controller (query/form binding and exception mapping)
  with per-client stubs and a serialized code store, 17 of 17 security tests fail and 13 of 13
  functional tests pass.
- The oracle (the published source fix plus fixes for both injected siblings) passes 17 of 17
  security and 13 of 13 functional tests, and the project's own tests for the module also pass on
  the oracle (`OAuth2ClientTest`, `OAuth2AuthorizeControllerTest`, `OAuth2ScopeUtilsTest`; 7 run, 0
  failures, 2 skipped). The same project tests pass on the injected baseline, offline.
- `injection.patch` applies to the pinned commit and `fix.patch` applies to the injected baseline;
  the resulting tree is byte-identical to the oracle tree, and the reference fix still applies after
  the injection.
- Every check patch applies to the injected baseline and behaves as declared locally (one
  near-complete fix per lever): `sec_fail_shape` 9 security failing / 0 functional;
  `sec_fail_binding` 5/0; `sec_fail_legacy` 3/0; `sec_fail_error` 9/0; `sec_fail_malformed` 1/0;
  `sec_fail_crash` 1/0; `func_fail_exact` 4 security / 6 functional failing; `func_fail_refuse_all`
  functional failing; `pass_alternative` and `pass_hardening` both 0 failing (reward 1.0).
- The pinned commit does not contain the advisory's regression tests: the fix commit adds new
  methods to `OAuth2ClientTest` and a new `DefaultAuthorizationCodeGranterRedirectUriTest`, neither
  of which exists at the pinned commit.

## What could not be verified

- The Docker/Harbor stages are recorded in the gate report and evidence files, not here.
- The verifier's offline Maven build and the hidden suites were exercised with the same commands
  locally (`mvn -o ... compile`, `javac`, the JUnit console launcher); the container run is the
  gate's.
- The harness drives the product's controller and grant classes directly with stubbed collaborator
  interfaces (client registry, token manager, serialized store) rather than booting the whole Spring
  Boot application, because the full application needs a database and Redis; the controller,
  request binding, exception mapping, granter and code store are the product's own classes.
- The two injected siblings are reached over the product's controller; their behaviour in a full
  deployment (authentication filters, the global response wrapper) was not booted.

## Out of scope (one line)

The repository's other `startsWith` uses (bearer token parsing, database type matching) and the
programmatic grant APIs do not reach a redirect sink; not built on.

## Gate results

- `static`: PASSED. The only remainder is the missing `checks/pass_blind.patch`, which the blind
  reviewer writes after the build; nothing else was reported.
- `nop`: PASSED. The injected baseline produced 17 security failures and 13 functional passes
  (reward 0.0; metrics: passed 13 / failed 17 / total 30).
- `oracle`: PASSED. Three identical runs, each 30 of 30 tests passing, reward 1.0.
- `patches`: PASSED. All ten declared checks behaved as declared:
  `sec_fail_shape` 9 security / 0 functional failing; `sec_fail_binding` 5/0; `sec_fail_legacy`
  3/0; `sec_fail_error` 9/0; `sec_fail_malformed` 1/0; `sec_fail_crash` 1/0; `func_fail_exact`
  4 security / 6 functional failing; `func_fail_refuse_all` 5 security / 12 functional failing;
  `pass_alternative` reward 1.0; `pass_hardening` reward 1.0.

## Pattern B register

No Pattern B rows: the two sibling gaps are injected (track: injected); no unmodified upstream
route into a redirect sink exists beyond the ones the published fix covers.

