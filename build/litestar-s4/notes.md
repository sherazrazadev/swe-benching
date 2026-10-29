# litestar-s4 build notes

- Start: 2026-10-29T11:45:45Z (driver start recorded in build/litestar-s4/start_utc.txt).
- Build finished (task files written): 2026-10-29T12:01:38Z. Gate stages finished: 2026-10-29T12:09:39Z.
- Pattern: B. Track: injected. Advisory: GHSA-3QMC-CJ7Q-62HV / CVE-2026-48061 / PYSEC-2026-2603.
- Pinned commit: 299a5845d2e9a067ed7fb716fecf518cfed8b67b. Fix commit: 6930a20ceb543912cd651b42deae5b9f3637a262.

## Levers (one line each)

- T1 (reported, real upstream): missing Host + `X-Forwarded-Host: <allowed>` is served; the published fix's site, `litestar/middleware/allowed_hosts.py:67`.
- T2 (pattern B, real upstream, how-type shape): the check keeps the text before the first `:`, so `Host: allowed:80@evil` is served and the redirect variant points the client at `evil`; `allowed_hosts.py:67` + `litestar/datastructures/url.py:182-201`.
- T3 (pattern B, real upstream, route where the protection never existed): the gate is per route node, so unknown paths and unsupported methods are answered by the router's 404/405 for a disallowed host; `litestar/_asgi/routing_trie/mapping.py:216-217`, `traversal.py:54,85`, `asgi_router.py:89-100`.
- T4 (injected, how-type producer off the check's path): the request URL builder prefers a client-supplied `X-Forwarded-Host`, so the addresses the app returns (and the redirect target) name the client's host; `litestar/datastructures/url.py:181-199`, added by `environment/inject.patch`.

## What was verified

- Reproduced every security outcome over a real loopback socket to uvicorn at the pinned commit (and at pinned+injected), not by calling helpers:
  - no Host + X-Forwarded-Host allowed -> 200 handler ran (T1); the published one-line fix turns this into a 500 (missing-Host `AttributeError`), which the suite rejects as not a client error.
  - `Host: ok.example.com:80@evil.com` -> 200 (T2); redirect variant `Host: moishe.zuchmir.com:80@evil.com` -> 302 to a Location whose parsed host is `evil.com`.
  - `Host: evil.com` on an unknown path -> 404 and on a POST to a GET route -> 405 (T3).
  - injected producer: `Host: ok.example.com` + `X-Forwarded-Host: evil.example.net` -> `request.url`/`base_url` name `evil.example.net`; the redirect variant -> 302 to `www.evil.example.net`.
- Hidden suites locally: 7 security tests fail on pinned+injected and all pass on the oracle; 9 functional tests pass on both; the oracle also passes the selected project behavioural tests (10 cases) and the full project allowed-hosts file (13 cases).
- Each wrong-fix patch was run locally against the hidden suites: `sec_miss_reported` (1 security fail), `sec_miss_shape` (2), `sec_miss_route` (1), `sec_miss_producer` (1), `func_reject_forwarded` (1 functional fail), `func_refuse_all` (6 functional fails), `hardening` (16 pass), `alt_fix` (16 pass).
- `fix.patch` was generated against the pinned+injected tree and applies cleanly; `inject.patch` applies cleanly to the pinned checkout.
- Present-in-latest is a read-only look at the clone's `origin/main`: T2's exact bypass is not present (latest rejects invalid host syntax and fullmatches the raw host); T3 is still present (latest validates only host syntax before routing); T4 is injected, not upstream.

## What could not be verified

- Docker/Harbor runs were not completed at the time of writing; the gate stages below produce the authoritative result. No trial was run by hand.
- Whether a real reverse proxy forwards a Host value containing `@` unmodified; the test drives the ASGI server directly and the server accepted it.
- `present_in_latest` for T2/T3 is from reading `origin/main`, not from executing latest.
- The project's three layer-structural allowed-hosts tests are deliberately not run (they assert where the middleware is installed); a fair fix may place the gate at another layer. Only the behavioural tests from the pristine pinned file are scored.
- The CORS-preflight and websocket 404 paths were investigated and not built: preflights never reach application code and would be one more route of the same concept; the ws route needs a missing Host on a handshake, which a real client cannot send.

## Notes on the tests

- Security tests send raw HTTP/1.0 frames when the Host header must be absent; HTTP/1.1 requires Host, so this is the realistic wire form.
- The suite compares the response for a disallowed host on an unknown path/method with the response for the same host on a valid route (status and body), so it passes any fix that refuses consistently and does not demand one exact status.
- Functional tests pin the coupled behaviour: wildcard, host:port, redirect variant, redirect disabled, allow-all, stray forwarded header ignored, legitimate 404/405.

## Gate results

- static: PASSED (`gate_report.static.json`).
- nop: PASSED - 7 security tests fail on pinned+injected, 19 functional tests pass.
- oracle: PASSED - 3 runs, every run reward 1.0 with identical results (7/7 security, 19/19 functional).
- patches: PASSED - all 8 declared checks behaved as declared:
  - sec_miss_reported.patch: security_fail (1 security failure: forwarded-host stand-in; functional all pass)
  - sec_miss_shape.patch: security_fail (2 security failures: both authority-prefix inputs; functional all pass)
  - sec_miss_route.patch: security_fail (1 security failure: routing-error refusal; functional all pass)
  - sec_miss_producer.patch: security_fail (1 security failure: URL builder; functional all pass)
  - func_reject_forwarded.patch: functional_fail (1 functional failure; all security pass)
  - func_refuse_all.patch: functional_fail (11 functional failures; all security pass)
  - hardening.patch: pass (reward 1.0, 26/26)
  - alt_fix.patch: pass (reward 1.0, 26/26)
- Evidence kept in build/litestar-s4/: gate_report.static.json, gate_report.patches.json, gate-nop.log,
  gate-oracle.log, gate-patches.log. The blind.patch entry is declared in the manifest; its file is produced
  by the blind-fix stage after this build, so the gate skips it here (as the brief allows).
