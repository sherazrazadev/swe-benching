# reactor-netty-s4 — build notes

- Start (UTC): 2026-10-30T11:28:54Z
- End (UTC): 2026-10-30T13:05:00Z (build and all four gate stages complete)
- Pattern B, injected track. Pinned commit `b26ac28dffa7d745f17fa2cae31feade30bf1f22`, published fix
  `e7ef551eead84ba465324531683fafa03ab96ee9` (one line, `HttpClientConnect.java:618`).

## The single property

No `Authorization`, `Proxy-Authorization` or `Cookie` value the application supplies may reach a redirect
destination that is less protected than the destination it was supplied for: a different host or port is a
different destination, and a plaintext destination is less protected when the request it was supplied for was
encrypted. The rule covers every request the client emits while following redirects and however the value was
supplied. Stated once in `instruction.md`; no route is described there.

## Levers (one line each)

- **T1 (reported site).** A TLS origin redirecting to the plaintext address of the same host and port is not a
  "different endpoint", so the sensitive headers are never removed; the published fix adds the secure→insecure
  case at `HttpClientConnect.java:618`. Dismissal: the docs promise removal only for a different domain.
- **T2 (how-type, real uncovered route).** The WebSocket handshake branch returns at `HttpClientConnect.java:596`
  before the redirect header decision is installed at 617, so a configured credential survives a wss→ws downgrade
  and a cross-host redirect. Dismissal: a neighbouring feature with its own send path; the early return looks
  deliberate; the docs speak of HTTP redirects only.
- **T3 (how-type, injected producer off the decision's path).** The client retains the cookies it was configured
  with (`HttpClientConfig.java:138-139`) and re-adds them at send time after the decision removed the header
  (`HttpClientOperations.java:707-709`), so cross-origin and downgraded hops get them back. Dismissal: a
  client-configured cookie looks like the caller's own choice; the existing per-request cookie re-add is
  documented, legitimate behaviour.
- **T4 (injected wrong-object decision).** A same-host same-scheme redirect updates the reference endpoint
  (`HttpClientConnect.java:694-696`, helper at :704-706) before the decision runs, so a different port is treated
  as the same destination. Dismissal: host and scheme are unchanged, so it reads as the same site.

Main lever: T2 (route where the protection never existed) with T3 as the second how-type lever; T1 is the
reported clean-up every model is expected to do. Different dismissal reasons: neighbouring feature (T2),
caller-configured value (T3), same-site appearance (T4).

## Candidate sibling sites considered, and why the picks won

1. WebSocket handshake early return (real upstream) — **picked (T2)**: the only other send path, real and
   unmodified, four lines of route plus two handshake classes away from the decision, with a genuine reason to
   dismiss.
2. Per-request cookie list re-add in `beforeMarkSentHeaders` (real upstream, screener O8 #2) — **rejected**: the
   list is only filled by caller code that runs on every hop (`doOnRequest`, `send`), and re-adding a cookie in
   the redirect consumer is documented behaviour, so a test would punish a legitimate documented use. Replaced by
   T3, which is library-driven retention of the client-configured cookie.
3. Updating `fromURI` inside `redirect()` (screener O8b #2) — **rejected after behavioural testing**: the update
   runs at the end of a hop, before the *next* hop's decision, so it also disables cross-origin stripping on the
   first hop; the vulnerable tree would fail the functional cross-origin test, so it is not a usable sibling.
4. Making the cookie-list re-add conditional on the previous origin (screener O8b #3) — **rejected**: that is a
   fix direction, not a gap.
5. Diverging the two strip branches (handler branch drops one header, consumer branch another) — **rejected**:
   it sits in the block the report leads to, so a solver reading the fix site sees it; no distance.
6. A client-level Authorization retention mirroring T3 — **rejected**: a second copy of one idea, and no existing
   API stores Authorization outside the configured headers.
7. Applying `headersWhen` per hop after the decision — **rejected**: the supplier returns a `Mono` resolved once
   before the handler exists; moving it behind the decision would need a blocking rewrite, and a new synchronous
   supplier API would be invented rather than maintainer-realistic.
8. Re-applying `Proxy-Authorization` from proxy credentials on redirect — **rejected**: proxy credentials belong
   to the proxy and are applied in the transport layer; testing it needs a real proxy, and it is not a leak.
9. Server-set cookie replay (cookie jar from 302 `Set-Cookie`) — **rejected**: a large new feature whose protected
   data is server-issued rather than application-supplied, which would make the property statement doubtful.
10. Same-host fast path ignoring the port (injected) — **picked (T4)**: the decision is made on the wrong object,
    it is far from the report lead, surgical (upgrades, cross-host and the reported downgrade are untouched), and
    has its own dismissal reason.
11. Multi-hop tracking through a separate field updated after the hop is sent — **rejected**: no plausible
    update point outside the decision site itself.
12. An HTTP/2- or HTTP/3-specific redirect path — **rejected**: all versions share `requestWithBody`.
13. The form/multipart send path — **rejected**: it calls `markSentHeaders`, so the decision applies; no gap.
14. `addCookie` from `doOnRequest` — **rejected** for the same reason as candidate 2.

## Verified

- Behaviour on the pinned+injected tree: the hidden suite reports 6/6 security tests failing and 5/5 functional
  tests passing; the reference fix scores 11/11. Checked with the project's own Gradle build, offline, on JDK 17.
- Project tests at the pinned+injected tree: `HttpRedirectTest` (22 tests) and the `HttpClientTest` cookie/header
  tests (5 tests) pass.
- Every check patch was applied locally and run: `sf_t1_published` fails only the three downgrade-shaped security
  tests, `sf_t2_websocket` only the two handshake tests, `sf_t3_cookie` only the two configured-cookie tests,
  `sf_t4_port` only the different-port test, `ff_overbroad` and `ff_refuse_all` break functional tests,
  `pass_hardening` and `pass_alt` pass everything. All patches apply with `patch -p1`.
- Offline Gradle: after the cache warm, `./gradlew --offline` compiles and runs the suite with no network.
- The WebSocket route exists on upstream `origin/1.2.x` as well; `origin/main` closed it when the websocket branch
  was moved after the header decision in a later refactor.

## Gate results (stages run one at a time, in order)

- `static` PASSED (no missing files, no instruction leaks, conformance OK; only the pipeline-written blind patch and
  FAIRNESS.md are absent by design).
- `nop` PASSED: 6/6 security tests fail on the pinned+injected tree, 5/5 functional tests pass.
- `oracle` PASSED: 3/3 trials at reward 1.0 with identical results (6/6 security + 5/5 functional).
- `patches` PASSED: 8/8 checks behave as declared. `sf_t1_published` 0.5 (three downgrade-shaped tests fail),
  `sf_t2_websocket` 0.6667 (both handshake tests fail), `sf_t3_cookie` 0.6667 (both configured-cookie tests fail),
  `sf_t4_port` 0.8333 (the different-port test fails), `ff_overbroad` 0.0 and `ff_refuse_all` 0.0 (functional tests
  fail), `pass_hardening` 1.0, `pass_alt` 1.0.

## Could not verify

- Trial outcomes against the two target models (not run; the pipeline runs trials after the gate).
- Whether upstream will ever report the WebSocket route publicly (no advisory exists for it); the register row is
  marked `pending client decision`.
- Container memory/time behaviour of the Gradle build on the shared VM under full load; timeouts are sized from
  local runs (build ~2 min, suites ~30 s each).
- That the pinned snapshot dependencies stay resolvable upstream; the images warm the cache at build time, so the
  verifier does not need them afterwards.

## Out of scope, noted once

The transport-level proxy credentials in `reactor-netty-core`'s `ProxyProvider` are a separate sink for
`Proxy-Authorization`; not pursued.
