# serena-s4 — build notes

- Start (UTC): 2026-10-29T01:44:30Z
- End (UTC): 2026-10-29T02:07:35Z
- Advisory: GHSA-37H2-6P4F-MP3Q / CVE-2026-49471 / PYSEC-2026-3061 — oraios/serena; unauthenticated
  loopback HTTP service / DNS rebinding (CWE-306, CWE-352). Pattern B, track injected.
- Pinned (vulnerable) commit: `9c19d5f7f8c2e32e274ff7a6fca865ae0c1d0d09`. Published fix:
  `016ccbe1c095a3eed7967737ac1d4df2754f5d96` ("Dashboard: validate host and port on each request").
  Verified: the tree diff between the two commits touches only `src/serena/dashboard.py` (+9/−1),
  and the fix adds no tests, so the pinned tree contains no advisory regression tests.
- Reference fix in `solution/fix.patch` is the published fix's mechanism corrected to be
  port-independent and applied where each dashboard application is created, plus the same guard
  on the tray-manager application. It does not touch the injected sibling's module: that module
  serves the guarded application object.

## The single security property (as written in instruction.md)

The dashboard, and every local HTTP service Serena runs for it, serves a request only when the
request names a loopback address of this machine; every other request is refused with a client
error before it can read or change anything. A request that names a loopback address keeps working
exactly as today, whatever port the client used to reach the service.

## Behaviour verified on the pinned (injected) tree, without Docker

Probes used a real `SerenaDashboardAPI` over a stub agent/log handler (the agent is the external
boundary, like the project's own dashboard test), a real `SerenaDashboardTrayManager` whose tray
icon GUI was replaced by a boundary stub (the HTTP service is the subject), and plain HTTP with a
chosen authority.

| probe | pinned | published fix |
|---|---|---|
| GET /get_tool_names with a foreign authority | 200 + data | 403 |
| PUT /shutdown with a foreign authority | 200, agent shut down | 403 |
| POST /register on the tray service with a foreign authority | 200, instance stored | 200, instance stored (fix never touches it) |
| localhost through a forwarded port (compose publishes host port ≠ container port) | 200 | **403 — the published fix breaks the shipped container setup** |
| localhost on the listening port | 200 | 200 |

The published fix's literal `{127.0.0.1:<port>, localhost:<port>}` is therefore both too narrow
(it rejects legitimate forwarded-port clients) and incomplete (it leaves the tray service and any
second serving path untouched).

## Levers

- **T1 (main; how-type, coupled must-keep-working).** The decision is over the name, not the
  name-and-port. The obvious exact-authority guard rejects the shipped container setup where the
  browser reaches the dashboard through a forwarded port that differs from the listening port;
  the guard must take the name only and must live where the application is created.
  `src/serena/dashboard.py:770-780` / `:217`.
- **T2 (how-type shape).** A plausible guard matches a prefix or substring of the authority;
  attacker-controlled names such as `localhost.attacker.example` and
  `127.0.0.1.attacker.example` then pass. The whole name must match. `src/serena/dashboard.py:217`.
- **T3 (real uncovered route, pattern B).** The tray-manager service (`SerenaDashboardTrayManager`,
  own Flask application and launcher, `src/serena/dashboard.py:908-995,1126-1148`) applies no
  authority decision; its routes mutate the instance table and `/register` can open a supplied
  dashboard URL. Real, unmodified upstream code; the published fix never touches it.
- **T4 (injected sibling, pattern B).** A standalone WSGI entry point
  (`src/serena/dashboard_standalone.py`, injected) serves the same application object through a
  second launcher; a guard installed inside the ordinary launcher never runs on this path.
- Coupled functional behaviour: local requests through a forwarded port, the dashboard pages, and
  local writes must keep working on every serving path.

## Candidate sibling sites considered (full list) and why the picks won

Real upstream:
1. `SerenaDashboardTrayManager` Flask application + its launcher (dashboard.py:908-995,1126-1148)
   → **picked (T3)**. Reachable through its own public launcher; its HTTP service can be driven
   headlessly once the tray icon (a GUI boundary) is stubbed. Strongest real route: different class,
   own app, real side effects, plausible "experimental Windows-only helper" reason to dismiss.
2. `ProjectServer` (project_server.py:59-113, `/query_project`) → dropped. It is a separate,
   explicitly started service for read-only project queries; the advisory names the dashboard, so
   including it would stretch the advisory's protection outside its scope (recorded in the report).
3. The MCP server's HTTP/SSE transports (cli.py:259-273) → dropped: out of scope (not the dashboard).
4. `dashboard-viewer` CLI (cli.py:501-512) → dropped: it is a client, it runs no HTTP service.
5. `SerenaDashboardViewer` (pywebview) → dropped: GUI client, no HTTP surface.
6. The dashboard API's many routes → not siblings (same application; a per-application guard covers
   them, so they add no independent site).

Injected candidates:
7. A second launcher for the same application object (WSGI bootstrap) → **picked (T4)**, placed in a
   separate module for distance. Reason to dismiss: alternate deployment bootstrap, not a handler.
8. A "log stream" companion Flask app on its own port serving the same log data → dropped: it would
   be a second version of the same "another local service" concept as T4 and adds bulk without a
   new how-type mechanism.
9. A tray-manager `/open_dashboard` route taking a caller URL → dropped: it lives on the same
   application as T3, so guarding T3's app already covers it; it adds no independent decision.
10. A write-capable sibling of `/query_project` → dropped: it belongs to the out-of-scope project
    server, not the dashboard.

T3 beat the project server and the MCP transports because it is the same feature (dashboard
management), is reachable, and has real side effects. T4 beat the log-stream companion because it
is a different mechanism (one guard installed at one launcher versus the application) rather than
more of the same concept. No sibling is described in instruction.md; each falls under the one
property.

## Local dry runs (no Docker)

Pinned (injected) tree: 12/12 security tests fail, 8/8 hidden functional and 2/2 project tests pass.
Reference fix: 22/22. Each wrong-fix patch was applied to a fresh copy and matched its declared
outcome (see `manifest.verified.local_runs`).


## Gate results (run one stage at a time)

- static: PASS (2026-10-29T01:58Z), including the Frontier conformance check; the only expected
  absences are `blind.patch` (written later by another agent) and `FAIRNESS.md`.
- nop: PASS (2026-10-29T02:00Z) — 12 security tests fail on the untouched (injected) tree, 10
  functional tests pass (8 hidden + 2 project), reward 0.0.
- oracle: PASS (2026-10-29T02:02Z) — 3 runs, reward 1.0, identical 22/22 results.
- patches: PASS (2026-10-29) — every declared check matched: sf_remote_addr 12 security fail / 0
  functional; sf_loose_match 2/0; sf_no_tray 2/0; sf_launcher_only 4/0; sf_crash 12/0;
  sf_origin_only 12/0; sf_reads_only 5/0; ff_exact_authority 0 security / 5 functional;
  ff_refuse_all 1/8; pass_hardening 1.0; pass_alternative 1.0.

No container run needed network at test time; both images install everything at build.

## What I could not verify

- The advisory bodies themselves (GHSA-37H2-6P4F-MP3Q, CVE-2026-49471, PYSEC-2026-3061); only the
  provided summary was available.
- IPv6 loopback forms: Werkzeug 3.1.7's built-in trusted-host matcher mishandles `[::1]:port`, and
  container IPv6 support varies, so no test depends on it.
- The tray-manager GUI itself: the icon was stubbed; only its HTTP service is exercised.
