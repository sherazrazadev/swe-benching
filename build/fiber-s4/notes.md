# fiber-s4 build notes

- Start (UTC): 2026-10-29T11:27:30Z (see build/fiber-s4/start_utc.txt)
- End (UTC): 2026-10-29T12:00:23Z (all four gate stages complete)

## Candidate and scope

Advisory family: client-IP / header trust spoofing (CWE-290); unsafe append to an identity header.
Repo: gofiber/fiber (v3 mainline). Pinned: `40c0a5279ab14791974c34467ec3c57de5a36c8c` (first parent of
merge `1403cc82`). Published fix: `1403cc82` (BalancerForward `Header.Add` -> `Header.Set`, docs, one
regression test) plus a v2 backport merge `33c95012`; the v2 branch is outside the pinned tree and was
not read.

The pinned tree contains no copy of the regression test (the test is added by the fix branch), so the
hidden tests cannot have leaked from the pinned tree.

## The one security property (written once, before choosing routes)

Every request the proxy middleware forwards to an upstream must arrive there describing the client
address the middleware itself observed on the connection. A value the caller supplied in that header
must never reach the upstream, as the whole value or alongside the real one, on any forwarding path and
in any form the value can be supplied. Requests carrying it must still be served. A value the
application itself places on the outgoing request while the middleware prepares it is authoritative.

The instruction states this once, in product terms, and never names a route, file or function.

## Levers (one line each)

1. T1 landing, pattern A/published: `middleware/proxy/proxy.go:282` (BalancerForward). Reason to
   dismiss: the report's example; the published one-line fix appears to close it (it does not, see T6).
2. T2 main lever, pattern B, route where the protection never existed: `middleware/proxy/proxy.go:62-109`
   (configurable Balancer forwards through `fasthttp.LBClient.Do`, its own dispatch path). Dismissal:
   separate config-based balancer with an application request hook, assumed to manage its own headers.
   This is the how-type lever: a fix in the shared `Do`/`doAction` helper does not reach it.
3. T3, pattern B, routes where the protection never existed: `proxy.go:138-142` (Forward) and
   `proxy.go:239-247` (DomainForward). Dismissal: documented as thin pass-through wrappers.
4. T4, injected, ordering/wrong moment: `middleware/proxy/prefix.go:26-32` (PrefixForward sets the
   observed address, then `Header.CopyTo` resets the outbound header map and restores the caller's
   value). Dismissal: it visibly uses `Set`, so a grep suggests it is already correct.
5. T5, injected, wrong value source: `middleware/proxy/forwardedfor.go:13-20` (ForwardedForForward takes
   the address from the caller's `X-Forwarded-For` chain). Dismissal: reporting the forwarding chain is
   familiar reverse-proxy behaviour, and it uses `Set`.
6. T6, shape trap: repeated header lines. `fasthttp.RequestHeader.Set` replaces only the first stored
   value for that key (verified against fasthttp v1.71.0 `setArg`), so the second caller line survives.
   Dismissal: `Set` looks like a complete replacement; the project's own added regression test only
   covers one line.
7. T7, coupled must-keep-working value: an over-broad `Del` in the shared dispatch helper
   (`proxy.go:177-211`) strips the address the forwarders just set, and sanitising after the
   application's request hook discards the value the application set. Dismissal: "just delete the
   caller's header" is the smallest-looking fix.

## Full candidate list (screener O8/O8b plus own search) and why the picks won

Every place in the pinned tree that hands a client request to an upstream (searched for
`X-Real-IP`, `Header.Add/Set/Del`, `cli.Do`, `lbc.Do`, `fasthttp.Client`):

- `BalancerForward` (`proxy.go:272-285`) — PICKED (T1/T6). Published landing; shape trap added.
- `Balancer` (`proxy.go:19-110`) — PICKED (T2). Real unmodified code; separate `LBClient` dispatch; the
  screener's O8 route 1. Beat Forward/DomainForward as the main lever because a fix at the shared helper
  cannot reach it, so it forces the dispatcher to be understood, not just found.
- `Forward` (`proxy.go:138-142`) — PICKED (T3). Real; a thin `Do` wrapper.
- `DomainForward` (`proxy.go:239-247`) — PICKED (T3). Real; host-matcher.
- `Do` / `DoRedirects` / `DoDeadline` / `DoTimeout` (`proxy.go:144-175`) — NOT BUILT. They share
  `doAction`; current upstream deliberately keeps them as application-controlled pass-through helpers
  (its later `setRealIP` is applied by Forward/DomainForward/Balancer/BalancerForward only). Requiring
  them would conflict with the preservation clause (an app calling `Do` has already chosen the value),
  so they are recorded in the register as out of the tested set rather than relied on.
- O8b injection room `proxy.go:77-82` (Balancer's ModifyRequest) — REJECTED as an injected site: adding
  an append there would put a visible header write in Balancer and destroy the stronger T2
  "protection never existed" mechanism. Kept as the coupled ordering behaviour instead (T7).
- O8b injection room `proxy.go:205` (shared `doAction`) — REJECTED as an injected site: a second
  write there is a duplicate of the reported mechanism in the same function and a solver fixing the
  landing would likely touch it anyway. Kept as the over-broad wrong fix (T7 / del_doaction.patch).
- `middleware/proxy/proxy_test.go` helpers — not product code; no sink.
- Repo-wide search for other forwarding code — none; `middleware/adaptor`, `client`, `middleware/static`
  and the rest do not take an incoming client request and hand it to an upstream. So the injected
  siblings were placed in the same middleware package, in new files, where a maintainer adding
  forwarding conveniences plausibly would.

Injected picks (2 of the required 2-4), each a different dismissal reason:

- `PrefixForward` (T4): ordering/copy mechanism; a reader who greps the reported append pattern sees a
  `Set` and moves on. How-type: the fix needs the copy/reset order understood.
- `ForwardedForForward` (T5): caller-controlled value source; a `Set` is present but the value is
  wrong. How-type: the fix needs the trust source understood, not just the header replacement.

## Sites, routes, input shapes and tests

Security tests (14, one per site/route/form), all through a real handler mounted with `app.Use` and
driven with `app.Test` against an in-process loopback upstream:

- BalancerForward: single line, two header lines, comma list, empty value.
- Balancer: single, two lines, comma list, empty.
- Forward: single, two lines.
- DomainForward: single, two lines (Host matched).
- PrefixForward: single.
- ForwardedForForward: caller chain + caller address header.

Functional tests (10) plus 11 pristine project tests. The functional set covers ordinary proxying
(path/query/header/body/status), the load balancer, the host matcher (matching and non-matching), the
prefix rewrite, the forwarding-chain helper without a chain, a request carrying the header still being
served (positive control for refuse/500 fixes), the coupled observed address on BalancerForward, and the
application-set value winning in the balancer's request hook.

## Coupled must-keep-working behaviour next to each lever

- T1/T2/T3: ordinary forwarding and response return keep working; a request with no caller header still
  carries the observed address (BalancerForward), and the application's request-hook value still wins
  (Balancer, set before the hook, after the header is normalised).
- T4: the prefix rewrite, method, body and unrelated headers are still forwarded.
- T5: a request with no forwarding chain keeps working.
- T7: the two functional controls above are the coupled values; `del_doaction.patch` and
  `overwrite_hook.patch` fail exactly these.

## What was verified

- Pinned tree: project `./middleware/proxy` package tests pass (3.7 s). The only `X-Real-IP` write in
  non-test Go code is `proxy.go:282`.
- Behaviour on the injected vulnerable tree: all 14 security tests fail; all 10 functional tests and
  all 11 graded project tests pass.
- Oracle: 14/14 security, 10/10 functional, 11/11 project pass (also after applying
  `environment/injection.patch` then `solution/fix.patch` to a clean pinned checkout).
- All 14 `build/fiber-s4/checks/*.patch` were applied one at a time to a fresh injected tree and run:
  the security_fail patches leave functional+project passing (published_only 3/14; set_only 10/14;
  single_value_only 12/14; no_balancer 10/14; no_forwarders 10/14; no_prefix 13/14; no_xff 13/14;
  no_landing 10/14); refuse_all and crash fail 5 functional; del_doaction fails 9 security and 2
  functional; overwrite_hook fails 1 functional with security all passing; hardening and alt_shared
  pass everything.
- fasthttp semantics read in the pinned dependency source: `Header.Set` -> `setArg` replaces the first
  matching value only; `Header.Del` -> `delAllArgs` removes every matching value; `RequestHeader.CopyTo`
  resets the destination header map. This is the mechanism behind T4 and T6.
- Current upstream (read-only, `origin/main` 7b91997a): Balancer, Forward, DomainForward and
  BalancerForward now use a shared `setRealIP` that deletes every inbound field line and adds the peer
  address; Do/DoRedirects/DoDeadline/DoTimeout still do not. This confirms the tested route set and the
  Del-then-Add design, and it is why the raw helpers are not required.

## What could not be verified

- The published one-line fix is incomplete for repeated header lines (proved against fasthttp here);
  whether upstream intended the stronger property is not claimed.
- `present_in_latest` for the routes is from a read-only look at `origin/main`; no release tag was
  inspected.
- Docker image builds, Harbor trials and the nop/oracle/patches gate stages are run after this note;
  their results are recorded in `build/fiber-s4/gate_report*.json` and the final section below.
- The v2 backport branch was not read (outside the pinned tree).

## Fairness notes

- The report states the property once and never names a route, file, function, line or advisory id.
- Every tested route is reachable from a public handler with an ordinary HTTP request; no network,
  GPU, kernel or GUI is needed. Loopback listeners are in-process and offline.
- The strongest requirement (repeated header lines) is standard HTTP and is covered literally by "not
  alongside the real one" and "every form in which the value can be supplied".
- The application-set-value requirement is exercised only through the balancer's documented request
  hook, the one place the product itself offers it; the raw `Do*` helpers are left alone.
- Expected values are constants computed in the tests (`0.0.0.0`, the app.Test peer), not product
  calls, so a hardened product helper cannot break the bookkeeping.

## Scope notes

- The v2 branch/backport is outside the pinned tree and was not read. No other advisory is in scope.
- `Do*` helpers are real pass-through routes left unmodified upstream; they are recorded in the
  register but not tested.

## Gate results

- **static: PASS** (`python3 -I common/gate/gate.py fiber-s4 --only static`). Also `conformance_check.py` reports "conforming".
- **nop: PASS** — on the injected vulnerable tree every security test failed (14/14) and every functional test passed (21/21: 10 hidden + 11 pristine project tests); reward 0.0.
- **oracle: PASS** — 3/3 runs reward 1.0, each 14/14 security and 21/21 functional, identical results across runs.
- **patches: PASS** — 14/14 checks behaved as declared (gate_report.partial.json):
  - security_fail with all functional+project passing: published_only (11 security fails, reward 0.2143),
    no_landing (4, 0.7143), set_only (4, 0.7143), single_value_only (2, 0.8571), no_balancer (4, 0.7143),
    no_forwarders (4, 0.7143), no_prefix (1, 0.9286), no_xff (1, 0.9286);
  - functional_fail: refuse_all (14 security + 6 functional), crash (14 + 6), del_doaction (9 + 2),
    overwrite_hook (0 security + 1 functional);
  - pass at reward 1.0: hardening, alt_shared.
  `pass-blind.patch` is listed in `patch_checks` with kind `blind` and is written by the separate
  blind-fix stage; it has no file at build time and the gate skips it.

Stage logs kept next to this file: `gate-static.log`, `gate-nop.log`, `gate-oracle.log`, `gate-patches.log`.
