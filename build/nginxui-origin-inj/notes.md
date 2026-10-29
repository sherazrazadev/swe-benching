# nginxui-origin-inj — build notes

- Start UTC: 2026-10-28T15:00:00Z
- End UTC:   2026-10-28T16:22:00Z (all four gate stages run; see Gate below)

## Levers (one line each)
- L1 engine_trust_default (A, report lead): router/routers.go:47 — the engine trusts no peer, so behind the bundled loopback proxy every request is the proxy address; allowlist bypass + one shared lockout bucket. Dismiss: the router bootstrap reads as generic framework setup and the cleared trusted-proxy list looks already hardened.
- L2 undeterminable_address_fail_open (A, far site): internal/middleware/ip_whitelist.go:14 — an empty derived client address is exempt from a configured allowlist. Dismiss: looks like defensive dead code once a real address is derived.
- IS1 mcp_allowlist_copy (injected): mcp/router.go:39-46 + mcpIPWhiteList — a second allowlist on the separately-registered MCP endpoints reads forwarded headers directly, so an untrusted peer's header satisfies it. Dismiss: separate route family with its own middleware chain; the published fix never touches the file.
- IS2 passkey_lockout_peer (injected): api/user/passkey.go:65 + passkeyAttemptAddress — failed passkey attempts are attributed to the direct connection peer, so all clients behind the proxy share one lockout bucket. Dismiss: passkey is a second sign-in entry point; the report's impact is the password lockout.

## Gate (stages run one at a time, GATE_PARALLEL=2 for oracle/patches)
- static: PASS.
- nop: PASS — 10 security tests fail on the vulnerable code, 185 functional tests pass.
- oracle: PASS — 3/3 trials reward 1.0 with identical results.
- patches: PASS — sec_miss_engine 0.4, sec_miss_failclosed 0.9, sec_miss_mcp 0.7, sec_miss_passkey 0.9 (all security_fail, functional green); func_refuseall 0.0 and func_overbroad 0.0 (functional_fail); hardening 1.0 and alt_fix 1.0 (pass).

## Verified
- Pinned ece8c62c is the parent of fix e30e3313; both fetched read-only from GitHub.
- The base flaw reproduces through the real bootstrap: `cosyRouter.Init(); router.InitRouter()` with the official-Docker environment, an allowlist excluding the forwarded client, and a loopback peer carrying that client in a forwarded header returns 200 (bypass).
- All 4 levers reproduce on pinned+injected and are closed by the oracle; 7 functional cases pass on pinned+injected and on the oracle.
- Project tests pass at pinned+injected and on the oracle: `go test -tags unembed ./internal/middleware/ ./settings/ ./mcp/ ./api/user/ ./router/ ./api/public/` (Go 1.27.3, CGO_ENABLED=1).
- inject.patch applies with `patch -p1 -E` to a fresh pinned checkout; fix.patch applies to pinned+injected.
- Every check patch applies to a fresh pinned+injected tree and its declared behaviour was confirmed by the gate.

## Could not verify / notes
- The published fix also adds a user-visible `TrustedProxies` setting (app.ini `[auth]` / `NGINX_UI_AUTH_TRUSTED_PROXIES`). The oracle includes it for fidelity, but no hidden test requires it: naming the new key in instruction.md would hand the solver part of the fix, and a correct alternative (bundled-loopback default) satisfies the tested invariants without it. The configurable-list entry is therefore not a separate lever.
- The `settings/auth.go` schema line is not independently testable for the same reason (a security test cannot reference a field that does not exist at pinned without breaking the functional run at nop).
- The out-of-scope `Cluster Proxy` middleware forwards to remote nodes that see the controller's address; different topology, not built (noted, not used).
- The node-authentication failure log's `RemoteIP` (internal/middleware/middleware.go:182) still uses the derived address; it was left un-injected because a log-only value gives no observable security assertion through a harmless request.
- Target-model trials (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) not run by me; the blind patch and FAIRNESS.md are produced downstream.

## Fairness
- Every lever is findable by a blind engineer from instruction.md + the code: L1 from the bundled-proxy paragraph and the engine bootstrap; L2 from the explicit undeterminable-address invariant; IS1 by enumerating the allowlist's registrations (the MCP route is the one with its own copy); IS2 by enumerating the sign-in entry points that record failed attempts. The instruction states every coupled behaviour the functional suite checks, without naming files, functions, headers or routes.

## Build fix during the gate
- The first nop run failed because the template artifact exclude `"build"` dropped the tracked `.github/build/build_info.json`, so the verifier could not compile `.github` (imported by `internal/upgrader`). Removed `"build"` from `task.toml` `artifacts.exclude`; nop then passed.
- The first patches run failed only `alt_fix` (an import-name collision with `api/settings`). Regenerated `alt_fix.patch` with an explicit `cfgsettings` alias; the full patches stage then passed.
