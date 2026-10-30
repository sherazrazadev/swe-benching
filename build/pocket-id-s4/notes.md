# pocket-id-s4 build notes

Start (UTC): 2026-10-29T17:13:40Z
End (UTC): 2026-10-29T19:09:00Z

## Task

- Repo: `pocket-id/pocket-id` at the vulnerable commit `73bda4580a0b28fbf64a3d61b9b16e3f4b88ee51`.
- Published fix: `8a7577497131229badb35cb4b3a4227b1300afff`.
- Advisory: GHSA-2WVM-8MVP-22QV / CVE-2026-55834 / GO-2026-6305; CWE-601 open redirect.
- Pattern A+B, injected track. The reported flaw is real and reproduces at the pinned commit through
  `GET /authorize` driven in a headless browser: a `prompt=none` refusal with an unregistered
  `redirect_uri` sends the browser to that address with the error appended.

## Property (stated once in instruction.md)

Pocket ID must never send the user's browser to a redirect address the requesting client has not
registered; if the requested address is not registered (including when the client has registered
none), the request must stop on the authorization screen with a visible error, the browser must not
leave the application, and nothing may be registered or changed as a side effect. One property; it
covers the refusal paths, the injected sinks, the zero-registered client and the wildcard-host miss,
and it does not name any of them.

## Levers (one line each: pattern, shape, where, reason to dismiss)

1. **T1 prompt-path scope** (A/B, real upstream, where-type). The same refusal has three prompt
   outcomes; the report shows one. `frontend/src/routes/authorize/+page.svelte:66-90,134`.
   Reason to dismiss: "the report is about the login-required outcome; the others are different
   validations."
2. **T2 client with no registered address** (B, real upstream, how-type via a side effect). The
   error path must refuse, but the project's registration-time helper would trust and *store* the
   requested address (TOFU). `backend/internal/service/oidc_service.go:1518-1546`.
   Reason to dismiss: "a client with no configured address registers the first one it uses."
3. **T3 registered-pattern matching** (coupled, real upstream, how-type). Exact equality breaks
   registered wildcard patterns and loopback addresses on any port (RFC 8252).
   `backend/internal/utils/callback_url_util.go:30-58`. Reason to dismiss: "strict equality is the
   safest check."
4. **T4 injected denial redirect** (injected). A separate sink reports the user's decision using the
   page's raw address. `frontend/src/routes/authorize/+page.svelte:191`.
   Reason to dismiss: "declining is just navigation, not an authorization result."
5. **T5 injected failure-forward** (injected). A silent request that fails in the service is
   forwarded to the page's raw address. `frontend/src/routes/authorize/+page.svelte:186-193`.
   Reason to dismiss: "silent requests must always answer the client."
6. **T6 pushed-request carrier** (coupled, real upstream, how-type). The address can arrive in a
   stored pushed request rather than in the URL; a guard that reads only the URL substitutes a
   different registered address. `frontend/src/routes/authorize/+page.ts:18`.
   Reason to dismiss: "the address is in the request."

How-type levers: T2 (reusing the registration helper stores the attacker address), T3 (matching
semantics), T6 (the address comes from another record). T1/T4/T5 are scope/where extras.

## Full candidate list and why the picks won

Real upstream candidates found by searching the redirect sinks and the OIDC service:
- the three `prompt=none` refusal outcomes (login/interaction/consent): picked as T1 — the strongest
  scope lever, covered by the published fix but not by its own tests;
- a client with zero registered addresses (the error path skips registration entirely): picked as T2
  — a real route where the protection never existed, and the existing helper turns it into a
  side-effecting trap;
- the project's pattern/loopback matcher: picked as T3 — the coupled behaviour that catches
  over-broad fixes;
- the pushed-request carrier: picked as T6 — a legitimate flow whose address is not in the URL;
- logout `post_logout_redirect_uri`: not picked — the pinned code already validates it against the
  client's logout addresses, so no real gap exists; an injected TOFU fallback would be a second
  feature, not a sibling of this sink;
- the unauthenticated client metadata route / new callback-url route exposing configured addresses:
  not picked — information exposure, a different protection;
- the login `redirect` query parameter (`/login`, `/login/alternative/code`): out of scope — not the
  OIDC client redirect; noted only.
Injected candidates (all separate sinks on the authorization screen, untouched by the published fix):
- denial redirect (OIDC `access_denied`): picked as T4 — plausible, reachable by a visible UI action,
  and a separate code path;
- forwarding a failed silent authorization (`server_error`): picked as T5 — a different trigger
  (backend failure) and a separate function;
- a second authorization page or stored-address cache: rejected as less realistic and heavier than
  the two sinks above. T4 and T5 won: each is a few lines a maintainer could plausibly add, each is
  reached through the real screen, and each is covered by the one property without a sentence of its
  own.

## Verification performed (host builds, then the built images)

- Pinned+injected build: all seven security scenarios navigate the browser to the refused address;
  all seven functional scenarios pass.
- Oracle build (published fix + the two sibling fixes): all seven security scenarios refuse with the
  screen still shown; all seven functional scenarios pass.
- Hidden suites on the pinned+injected build: security 0/7, functional 7/7.
- Hidden suites on the oracle build: security 7/7, functional 7/7.
- The same two results were reproduced inside the built images, through the verifier's own path:
  a restored source tree (no node_modules/dist) built offline as uid 1000 from the tests image's
  pristine dependency tree, with the bundled Chromium. Pinned+injected: security 0/7,
  functional 7/7. Oracle: security 7/7, functional 7/7.
- Wrong-fix patches were built and run individually: each `security_fail` patch leaves the security
  test(s) for its lever failing while all functional tests stay green; each `functional_fail` patch
  breaks only the declared functional behaviour and keeps all security tests green; both `pass`
  patches score 14/14.
- Project's own end-to-end OIDC suite: the full `tests/specs/oidc.spec.ts` (54 tests, including all
  PAR flows and the prompt group) passes inside the built environment image at the pinned+injected
  commit with the bundled Chromium (54/54).
- Verifier defect found and fixed before the gate: the e2e seed's key material is encrypted with the
  project's test key, so the verifier server must start with that exact key; with any other key the
  seed reset returns 500 and every test fails.

## Gate results

- static: PASS (only the declared-but-unwritten `blind` patch is absent, as expected at this stage).
- nop: PASS. The pinned+injected build fails all 7 security tests and passes all 7 functional
  tests inside the verifier image (security 7, functional 7 counted; every security test failed).
- oracle: PASS, 3/3 strict runs reward 1.0 with identical security/functional results.
- patches: PASS. All nine declared checks behaved as declared inside the verifier image:
  `security_fail_reported_only` (4 security failing), `security_fail_nocb` (1), `security_fail_deny`
  (1), `security_fail_error_forward` (1) — all with functional green; `functional_fail_exact_match`
  (2 functional failing: loopback, wildcard), `functional_fail_query_only` (1: pushed request),
  `functional_fail_refuse_all` (6) — all with security green; `hardening` and `alternative` both
  reward 1.0.
- Wrong fixes also run end-to-end in the verifier image: `functional_fail_query_only` (security
  7/7 pass, functional 6/7, only the pushed-request test fails), `security_fail_nocb` (security
  6/7, only the zero-registered-client test fails; functional 7/7), and
  `functional_fail_exact_match` (security 7/7 pass; functional 5/7, loopback and wildcard fail).
  All match their declared behaviour. Both `pass` patches (hardening, alternative) were also rebuilt
  in the verifier image and score security 7/7 + functional 7/7.

## Could not verify

- `present_in_latest` for the zero-registered-client route: current upstream `main` has split the
  backend service and moved the authorize route, so a read-only look did not locate the equivalent
  code; recorded as `unknown` in the register.
- Behaviour under the trial harness's load (several containers); the gate runs reported above are
  the evidence for this machine.

## Noticed outside the advisory's scope (not built on)

- The `redirect` query parameter on `/login` and `/login/alternative/code` is an unvalidated
  internal redirect; it is not the OIDC client redirect this advisory protects.
- `getLogoutCallbackURL` indexes `LogoutCallbackURLs[0]` but only after a non-empty length check.
- The new unauthenticated callback-address endpoint reveals a client's registered addresses to
  anyone who knows the public client id; a different protection, not pursued.
