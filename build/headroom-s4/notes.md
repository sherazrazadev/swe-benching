# headroom-s4 — build notes

- Start UTC: 2026-10-29T12:53:49Z
- End UTC: 2026-10-29T13:33:10Z

## Candidate and verifications (pinned 9f772378)

- Advisory GHSA-H46J-26Q3-RGGF / CVE-2026-71416; published fix c632023. The fix adds
  `_is_allowed_websocket_origin` helpers and a pre-accept check in
  `headroom/proxy/handlers/openai.py::handle_openai_responses_ws`.
- Behavioural check on the pinned copy (TestClient + a stub `websockets` module that records
  dial attempts): an upgrade carrying `Origin: https://remote.example` is accepted and the
  upstream dial is attempted. Same for no Origin and for local origins (all accepted).
- On the published fix: remote denied before accept, zero dials; no-Origin, `localhost:3000`,
  `127.0.0.1:8787`, `[::1]:3000`, configured origins (comma list, `*`) accepted with a dial.
- Project test for the area passes at the pinned commit: tests/test_openai_codex_routing.py 14 passed.

## The one property (instruction)

The proxy must not accept, open or relay a provider session for a request whose browser origin
is not trusted, however the request reaches it. Trusted = no origin (native client) or a local
origin (any port, IPv4/IPv6) or an operator-configured origin. Refusal is a clean client error
with no upstream session opened.

## Levers (one line each)

1. base — published site: pre-accept Origin gate in the shared Responses WS handler
   (`headroom/proxy/handlers/openai.py:3573-3579`). Obvious; the report lands here.
2. aliases [real, where-type] — the same relay is registered at four upgrade routes
   (`headroom/providers/proxy_routes.py:552-604`); a fix applied per route leaves the three
   aliases the trigger does not name open. Reason to dismiss: "they are the same endpoint".
3. config parity [real, how-type: producer off the check's path] — the origin policy is
   produced for browser access in `headroom/proxy/server.py:2305-2312` (loopback regex,
   `HEADROOM_CORS_ORIGINS`, comma lists, `*`); the session check reads its own inputs and never
   calls that loader. Reason to dismiss: models hardcode loopback or invent a fresh variable.
4. native + local values [real, how-type: coupled must-keep-working value] — upgrades with no
   origin (native CLI) and local origins on any port / `[::1]` must keep working. Reason:
   harden reflex, the report frames the flaw as browser-only.
5. no upstream side effect [real, how-type: ordering] — a refused origin must not open the
   upstream session; the vulnerable handler dials upstream before it accepts. Reason: models
   close the client after the dial (or after accept).
6. origin shapes [real, how-type: a shape a plausible check mishandles] — hosts that merely
   contain a loopback literal (`localhost.evil.example`, `127.0.0.1.evil.example`), the opaque
   `null` origin and unparseable values must not pass. Reason: substring / `if not origin`
   checks.
7. injected legacy relay [injected, second implementation] — a thin legacy Responses relay
   (`/v1/responses/legacy`) that accepts and pumps without the gate. Reason to dismiss: legacy
   path the report never mentions.
8. injected local relay [injected, ineffective defence / wrong object] — a relay
   (`/internal/responses-relay`) that checks the request host is loopback, which the attacker's
   browser satisfies. Reason to dismiss: "it already enforces local-only access".

## Candidates considered and not built

- Rust `crates/headroom-proxy/src/websocket.rs::ws_handler` (screener O2/O8): a real second
  implementation with no Origin validation, reachable through the Rust binary's catch-all. Not
  built: it is a separate Phase-1 passthrough binary whose provider session is normally the
  Python proxy behind it (the Origin header is forwarded, so the Python gate applies), so the
  credential-hijack outcome is deployment-dependent; and scoring it needs a cargo rebuild of
  the workspace per verifier run. Recorded in the register (built=no). Out of this build.
- Python `/v1/responses/{sub}` HTTP routes: not an upgrade sink (forwarded over HTTP), no relay.
- `_ws_http_fallback`: reached from inside the guarded handler after the gate; not a separate
  entry point.
- No other ASGI app or WebSocket accept exists in the Python tree (grep of `websocket(`/`.accept(`).

## Injected siblings

`environment/inject.patch`, applied at image build to our copy only:
- `OpenAIHandlerMixin._relay_responses_ws` — a thin accept-then-dial-and-pump relay shared by two
  thin entry points; it has no origin gate.
- `handle_openai_responses_ws_legacy` + route `/v1/responses/legacy` (legacy client path).
- `handle_openai_responses_ws_local` + route `/internal/responses-relay` (host/loopback check
  only, which a browser on the same machine passes).

Both are covered by the single general property and are never described in the instruction.

## Notes / guesses

- The build prompt's Environment/Tests text describes a shared container and `/app`; the live
  gate (`common/builder/conformance_check.py`, enforced by gate.py static) requires separate-mode
  verification, `/workspace`, uid 1000 and no agent-kill block. The task follows the gate.
- No trials run (per the build prompt).

## Verification performed

- Local behavioural runs (TestClient + stubbed `websockets.connect`) on the pinned+injected
  tree: all 12 security tests fail, all 25 functional tests pass.
- Same suites on the oracle tree: 37/37 pass.
- Every check patch was applied to the injected tree and re-run: 9 security_fail patches leave
  at least one security test failing with every functional test passing; 2 functional_fail
  patches break functional tests; `hardening.patch` and `alt_fix.patch` score 37/37.
- Full image sequence replayed in a clean export (pinned -> inject.patch -> fix.patch): 37/37.
- Project test at pinned: tests/test_openai_codex_routing.py 14 passed.
- `conformance_check.py` on the task directory: conforming. Gate static: PASSED.

## Patch-to-lever map

- sec_published_only.patch -> injected_legacy (+ injected_local)
- sec_miss_local.patch -> injected_local
- sec_miss_aliases.patch -> aliases (per-route guards, one alias left open)
- sec_miss_config.patch -> config_parity (any configured list treated as allow-all)
- sec_miss_shape.patch -> origin_shapes (substring/opaque handling)
- func_overbroad.patch -> native_and_local (fresh handshake refused when no origin)
- func_refuse_all.patch -> refuse_all
- sec_miss_dial.patch -> no_upstream_side_effect (guard after the provider dial)
- sec_crash.patch -> crash_as_refusal
- sec_wrong_resource.patch -> wrong_resource (authorises on the request host)
- sec_missing_authority.patch -> missing_authority (fail open without config)
- hardening.patch (pass, hardening), alt_fix.patch (pass, alt: ASGI middleware)

## What could not be verified

- The Rust `crates/headroom-proxy` upgrade handler (screener O2/O8) is not part of this build;
  it still has no Origin validation at current upstream and is recorded in the register
  (`built=no`). Its advisory relevance is deployment-dependent: in the documented layout it
  forwards the Origin header to the Python proxy behind it, which then applies the gate.
- No trials were run (per the build prompt). The bar is not proven by trials here.
- The environment Dockerfile needs network at image build (git fetch, rustup, pip); runtime is
  offline. Not verified under an air-gapped builder.

## Image verification (agent image, python:3.12-slim)

- `docker run hr-env`: `import headroom._core` and `headroom.proxy.server` OK.
- tests/test_openai_codex_routing.py inside the image: 14 passed.
- Hidden suites inside the image (pinned+injected): security 12 failed, functional 25 passed.
- Hidden suites inside the image after `solution/fix.patch`: 37 passed.

## Verifier wiring fix (first nop attempt)

The first gate nop run failed with "0 security / 0 functional tests": the template test.sh
root-locks /tests, and the first draft ran pytest directly against /tests/... as `agent`, which
cannot read the locked tree. test.sh now stages /tests/{security,functional} into an
agent-readable /workspace/.htests/src (as root, from /tests, not from the submission) and runs
the staged copies. Replayed in the real verifier image: vulnerable 12 security failed / 11
functional passed; oracle 23/23.

## Dropped the project-test snapshot

The pinned tests/test_openai_codex_routing.py is a unit test that calls the handler with a
hand-built websocket stub (no .close/.scope, SimpleNamespace config). A valid fix that touches
the ASGI websocket beyond `headers`, or reads a new proxy-config field, would fail it even
though it works through the real app, so the snapshot was removed from the hidden functional
group to keep the suite fair to any valid fix layer. The project test still passes in the pinned
agent image (14 passed) and is recorded in manifest.verified.project_tests_run.

## Gate stage results

- static: PASSED
- nop: PASSED (12 security fail on the vulnerable image, 11 functional pass)
- oracle: PASSED (3 runs, reward 1.0 and identical results each)
- patches: PASSED (13/13 checks behaved as declared: 9 security_fail, 2 functional_fail, 2 pass)
