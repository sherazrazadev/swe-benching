# process-compose-s4 — build notes (build-v1, pattern B, injected)

Start: 2026-10-29T01:44:37Z (start_utc.txt). End: see bottom.

Repo: f1bonacc1/process-compose. Pinned (vulnerable) `e429fa3ac3b0f31b7dab22987f47aef363251e8e`
(parent of fix `6ffa74f462cd2fa4f8dc1ee63c70b793b298c858`, verified with `git rev-list --parents`).
Advisory: GHSA-5GM3-9CRP-6G3V / CVE-2026-77339 / GO-2026-6515, CWE-306 + CWE-346. The published
fix adds `src/mcp/sse_security.go`, an owned `http.Server` in `src/mcp/server.go:startSSE`, a
shutdown path in `Stop()`, `trusted_hosts` in `src/types/mcp.go`, and the generated schema entry.

## The security property (stated once; every route/trap falls under it)

A request that is not from a trusted local client may never reach any of the product's local HTTP
control listeners — neither to make a control operation happen nor to read the process state/log
data they expose. A request is trusted only when the host it is addressed to names the local
machine (a loopback address) or a name the operator explicitly listed in the MCP server's
`trusted_hosts` setting; when the request carries an `Origin`, that origin must satisfy the same
rule; and when an access token is configured (`PC_API_TOKEN`), the request must present it through
`X-PC-Token-Key` or `Authorization: Bearer`. Otherwise the request is refused with a client error
and has no effect (no process started/stopped/changed, no state or log data returned).

The report's observed-impact example is the documented MCP SSE URL. The property is deliberately
wider than that example; the report never names the far sites.

## Levers (one line each)

- **T1 (how-type, main; pattern B real upstream): the other control listener.** The gin REST
  listener (`src/api/routes.go:33-82`, started for every normal run on `localhost:8080`) performs
  the same process-control operations with no Host/Origin validation at all; only an optional
  token when `PC_API_TOKEN` is set. Dismissal: the advisory names MCP; the REST token is
  documented as optional, so the REST surface looks out of scope. Distance: another package.
- **T2 (how-type; pattern B real upstream): the WebSocket stream routes.** Both streams
  (`src/api/ws_api.go:20,43`, `src/api/state_ws_api.go:82`) upgrade with gorilla's zero-value
  upgrader, whose default `CheckOrigin` compares the Origin host with the request Host — under DNS
  rebinding both carry the attacker's name, so it passes. Dismissal: read-only log/state streams
  and a default upgrader that is widely assumed origin-safe. Mechanism, not spelling: an
  in-handler Origin check is bypassable by the same mechanism, while a listener-level Host check
  is not.
- **T3 (how-type; the published fix's own listener): the JSON-RPC message endpoint.** The MCP SSE
  transport serves dispatch on a second endpoint (`/message?sessionId=…`, advertised by the SSE
  stream) as well as the documented `/sse` URL. A guard that wraps only the documented path leaves
  tool dispatch open. Dismissal: the docs name only the SSE URL; the message POST is internal
  plumbing.
- **T4 (how-type; shape trap): Host header forms.** The Host header carries `host:port`, IPv6 as
  `[::1]:port`, the whole `127.0.0.0/8` loopback range, `localhost` in any case and with a trailing
  dot, and it must fail closed when empty. Plausible hand-rolled checks (`== "127.0.0.1"`,
  `HasPrefix`, `HasSuffix`, a naive `Split(host, ":")`, or comparing Origin to Host) mishandle at
  least one form. Dismissal: a string comparison looks complete.
- **T5 (separate protection, CWE-306): authentication when a token is configured.** The REST side
  already enforces it; the MCP listener does not. Dismissal: the report is about origin validation
  and the token is optional, so auth looks like someone else's concern.
- **T6 (coupled must-keep-working):** loopback clients with no configuration; a deliberate
  non-loopback bind reachable through `trusted_hosts`; the explicit `trusted_hosts: ["*"]` opt-out;
  the documented `X-PC-Token-Key` / `Authorization: Bearer` (case-insensitive scheme) forms; SSE
  streaming itself (mcp-go asserts `http.Flusher` on the original writer, so a writer-wrapping fix
  silently breaks streaming); legitimate REST control and WebSocket use.

## Injected siblings (in our copy only, where the published fix never touches)

- **S1 — `src/api/request_trust.go` (new) attached in `InitRoutes`:** a plausible maintainer
  guard that compares the Origin host with the request Host and skips safe methods and upgrade
  requests. It is ineffective under rebinding (Host and Origin are both the attacker name), fails
  open when Origin is absent, and excludes exactly the reads and the streams. A solver who trusts
  it leaves REST reads and both streams open.
- **S2 — `src/api/ws_api.go:20`:** the package-level upgrader gets a custom `CheckOrigin` that
  restates gorilla's Origin-host-equals-Host rule (plus loopback origins). It looks like
  WebSocket-specific protection while remaining bypassable by the same rebinding mechanism.

Both are reachable through the real listeners, are covered only by the general property, and sit
in files the published fix does not touch. Every hidden test that covers them is expressed as the
general rule (untrusted Host/Origin refused, no effect), never as a sentence about these siblings.

## Candidate list (every sibling/route found before picking)

Real upstream / other surfaces: (1) gin REST control API — picked T1; (2) WS log stream — picked
T2; (3) WS state stream — picked T2; (4) MCP `/message` endpoint — picked T3; (5) unix-socket REST
listener (`src/api/server.go:16-47`, same router) — rejected: a browser cannot reach a unix socket,
so the property's browser-origin rule does not apply and a Host check there would break the CLI;
(6) swagger/`/live` routes — same router, covered by the REST fix, no separate sink; (7) MCP stdio
transport — not network-reachable; (8) `src/client`, `src/recipe`, `src/updater` — outbound clients,
not listeners; (9) the published SSE middleware itself — fix site, not a sibling.

Injection-room candidates: (A) a Host/Origin gate next to `TokenAuthMiddleware` — picked S1;
(B) a custom `websocket.Upgrader.CheckOrigin` — picked S2; (C) a per-endpoint guard inside the SSE
handler chain — rejected: the published fix touches that file; (D) a second HTTP listener
(legacy/admin) — rejected: no evidence such a listener ever existed, too implausible for a blind
engineer; (E) wrapping the TCP `http.Server` handler in `src/api/server.go` — kept as the
alternative *fix* layer, not a gap; (F) per-route groups guarding only `/process` — folded into S1
as the safe-method/upgrade exclusions (more plausible than a group, and it covers the same idea).

Why the picks beat the others: T1/T2 are real unmodified upstream code in a different package and
different transport from the report's landing point, with different reasons to dismiss; T3 is a
second route into the same dispatch that the documented URL hides; T4 is a parser mismatch that
survives a hand-rolled fix; S1/S2 are the only injected code that a maintainer could plausibly have
written without changing the published fix's files, and both create the "a check already exists,
so skip it" judgement.

## Sites, routes and input shapes the security tests cover

- MCP `/sse` with forged Host; MCP `/message?sessionId=` with forged Host using a session opened by
  a trusted client (tool dispatch); forged Origin; `Origin: null`.
- MCP with `PC_API_TOKEN` configured: no token / wrong token refused; correct token accepted.
- REST: `PATCH /process/stop/<name>`, `POST /project/stop`, `GET /process/<name>`,
  `POST /project/configuration` with forged Host (and forged Origin). Side effects checked through
  a legitimate loopback request.
- WebSocket `/process/logs/ws` and `/process/states/ws` raw handshakes with forged Host and forged
  Origin.
- Host forms: forged names (`attacker.example`, `127.0.0.1.attacker.example`,
  `localhost.attacker.example`, `attacker.example:127.0.0.1`), and legitimate loopback forms
  (`127.0.0.2:<port>`, `[::1]:<port>`, `LOCALHOST:<port>`, `localhost.:<port>`).
- `trusted_hosts`: exact name and different case accepted; `evil.<name>` refused; `"*"` accepted.

## Coupled functional behaviour per lever

- T1: loopback REST control/read operations keep working, including the project's own `src/api`
  tests. T2: a loopback WebSocket stream still upgrades and delivers events/log lines. T3: a
  trustworthy client can stream over `/sse` and invoke a control tool through `/message`. T5:
  both documented token forms work, including lowercase `bearer`. T6: trusted-host bind, wildcard
  opt-out, streaming (Flusher), project tests `./src/mcp ./src/types ./src/api`.

## Verified

1. The flaw reproduces at the pin through the real binary: `/sse` returns 200 and streams with a
   forged Host; a tool call on `/message` with a forged Host stops a process; `PATCH
   /process/stop/...` on the REST listener stops a process with a forged Host; both WebSocket
   streams return 101 with a forged Host+Origin.
2. The injected tree still reproduces all of it; the S1 origin check does not block a forged Host
   (no Origin, or a matching forged Origin) and skips reads/upgrades; the S2 CheckOrigin accepts
   the rebinding pair.
3. The same 20 security tests fail on the injected pinned tree and all pass on the oracle; the 12
   functional tests and the project's own tests (`./src/mcp ./src/types ./src/api`, 199 subtests)
   pass on both. The real `tests/test.sh` was run inside the verifier image with `--network none`:
   oracle reward 1.0 (231/231), injected tree reward 0.0 (20 security failures, 211/211 other).
4. Every `checks/` patch was built and run locally against the injected tree: each
   `security_fail` leaves at least one security test failing with all functional tests passing;
   each `functional_fail` breaks functional tests; both `pass` patches score 1.0.
5. Gate stages (run one at a time): `static` PASSED; `nop` PASSED (20 security fail, 211
   functional pass); `oracle` PASSED (3 runs, reward 1.0, identical results). `patches` result is
   at the end of this file.
6. Images build; the product's background update check is disabled in the verifier build with
   `-X .../config.Version=...`, so the test run stays offline.

## Could not verify / notes

- The target-model bar cannot be measured here (no trials were run); the design follows the
  pattern-B evidence and the injected-sibling rules.
- `present_in_latest` for the two uncovered routes was checked read-only at origin/main `f471d83`:
  `src/api/routes.go` still installs only the token middleware and both WebSocket streams still use
  the zero-value upgrader.
- mcp-go v0.55.0 was read from the module cache (`server/sse.go`): endpoints `/sse` and `/message`,
  default `Access-Control-Allow-Origin: *`, and the `http.Flusher` assertion at line 479.
- The unix-socket REST listener is deliberately not covered: a browser cannot reach it, and the
  oracle leaves it unguarded so the CLI's unix-socket mode keeps working.
- Out of scope, one line: the MCP stdio transport is not network-reachable and is untouched.


## End

End: 2026-10-29T02:33Z. Gate: `static` PASSED, `nop` PASSED (re-run on the final tests: 20 security
fail, 211 functional pass), `oracle` PASSED (3 runs, reward 1.0, identical), `patches` PASSED
(12/12: 8 security_fail with functional all passing, 2 functional_fail, pass_hardening and
pass_alt at 1.0). The blind patch and FAIRNESS.md are written by the later stages, by design.
