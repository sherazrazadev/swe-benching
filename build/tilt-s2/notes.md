# tilt-s2 build notes

Started: 2026-10-28T14:59Z (task assignment). Source: tilt-dev/tilt @ 65ddaecbdbe3bc733ddaed6ea471afb1ebd4307d; published fix 47393fba7f6ef5e305d5e814551feef8e4acbc0a.

## Levers (one line each)

1. HUD API routes (pattern A, real upstream) — every /api route returns or changes session state; the report shows one read, and the plausible fix only retunes the websocket handshake. `internal/hud/server/server.go:88-101`.
2. WebSocket credential (pattern A + input shape) — CheckOrigin accepts an absent or matching Origin as if it were a credential; same-origin and origin-less handshakes must still present the session credential. `internal/hud/server/websocket.go:49-56`.
3. Proxy plane (pattern A far site) — the same listener forwards requests to the session's Kubernetes API state; a different file, and it reads as protected by the API server's own auth. `internal/hud/server/controller.go:172`.
4. Legacy API aliases (injected, route where protection never existed) — old /api/v0 view and trigger routes; the view alias checks only that a token header is present, not that it is the session's. `internal/hud/server/compat.go:11-13`.
5. Secondary proxy mount (injected) — a second mount of the proxy handler under /k8s; wrapping the reported mount only leaves it open. `internal/hud/server/controller.go:173`.
6. CLI request helper (coupling, how-type) — the credential is produced at session start and consumed by the shipped command-line client; a server-only fix breaks the product's own tools. `internal/cli/utils.go:21-42`, plus the injected `internal/cli/status.go` raw-request command.
7. Live-log client (coupling, how-type) — tightening the stream handshake without teaching the product's own live-log client to fetch the stream value breaks it; the published fix itself leaves this client unchanged. `internal/hud/client/log_streamer.go:36-50`.

## Verified

- Flaw reproduces on the pinned tree through real entry points: unauthenticated GET /api/view, /api/dump/engine, /api/snapshot/{id}, /api/websocket_token; POST /api/trigger dispatches; a websocket dial with no Origin/Credential receives the live view; a same-origin websocket dial with no credential also connects; the fully wired controller forwards /proxy/... with no credential; injected /k8s, /api/v0/view (forged token), /api/v0/trigger behave the same.
- 17 security tests fail on pinned+injected and pass on the oracle; 15 functional tests pass on both. The functional group also runs the project's own server/client tests (TestAPIServerProxy excluded, see below).
- All nine wrong-fix patches were run locally against the suites and met their declared expectation (five security_fail, two functional_fail, hardening and alt pass).
- The published fix alone breaks the product's live-log client (`tilt logs` dials /ws/view with no csrf and no Origin); the oracle teaches that client to fetch the csrf value with the session credential. This is a real upstream regression, used as a coupled lever.
- The published fix's own project test (TestAPIServerProxy) sets TILT_DISABLE_HUD_AUTH in a test edit; since test edits are dropped, the pristine fixture has no session store and its unauthenticated proxy request is refused. That one test is skipped in the project group; the task's fully wired proxy tests cover the surface.
- Project suites `./internal/hud/server` and `./internal/hud/client` pass at pinned, and at the oracle with that one test skipped.

## Not verified / guesses

- The Go base image tag golang:1.25.5-bookworm was confirmed to exist; the image build itself is verified by the gate.
- Upstream's current main was not read for whether the legacy/proxy siblings exist there; they are injected into our copy only and are not claimed as upstream code.
- The /debug pprof loopback change from the published fix is kept in the oracle but is not part of the tested property: a non-loopback source address cannot be produced through a real local listener, so no behavioural test covers it.
- The snapshot viewer (`tilt snapshot view`) is outside the advisory's property (a static file the developer chose to publish), as the screener recorded; not built on.
- The published fix's vendor/modules.txt drift is unrelated and excluded.
- No target-model trial was run in this build; the gate is the only proof recorded here.

## Out of scope noticed

- The published fix also deletes vendor/modules.txt entries and edits project tests; both are unrelated to the authorization change and were not used.

## Gate results (2026-10-28T16:33:59Z)

- static: PASSED.
- nop: PASSED — 17 security tests all fail on the pinned+injected tree, 131 functional pass.
- oracle: PASSED — 3 identical runs, reward 1.0 each.
- patches: PASSED — sec_miss_http/ws/proxy/siblings/writes security_fail (reward 0.1176 / 0.8824 / 0.9412 / 0.8235 / 0.7059, functional all pass); func_break_clients and func_refuse_all functional_fail (reward 0); hardening and alt_fix pass (reward 1.0). The blind patch is listed but intentionally not written (the blind-fix stage writes it after the builder).
- instruction.md: 490 words.
