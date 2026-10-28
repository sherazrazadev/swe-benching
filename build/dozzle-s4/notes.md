# dozzle-s4 — build notes and design plan

Start (UTC): 2026-10-28T16:19:06Z
End (UTC): 2026-10-28T17:07:49Z

Advisory: GHSA-XCW9-QMMF-VQXJ / CVE-2026-62286 / GO-2026-6592 — amir20/dozzle, per-user
container label filter not applied to the events stream (CWE-285/CWE-200).
Pinned: b38117bfaecabf4ade318b93ff06269dbde273e9. Published fix: 19c01e0fb491c170796edba3da2692562c204e77.

## The product and the property

Dozzle is a web UI for Docker. One server joins several hosts and exposes container
metadata, live stats, lifecycle/health events, log streams, notification-rule previews,
an MCP integration and a debug view. When authentication is enabled an account can carry a
container label filter (`user.ContainerLabels`); that filter is the caller's permitted set.

The one property the whole task tests (written once, over the protected outcome):

> No response the server sends to a caller may carry data about a container outside the set
> that caller is permitted to see. This holds for every response, for every kind of container
> data, and however that data is produced or addressed.

The report's example is only the live event feed's stat channel. Every route and trap below
falls under the property as written; the report never names a far site.

## Main lever (how-type) — the events stream's stat channel and its coupled shape

`internal/web/events.go:63` forwards `container.ContainerStat` values without consulting the
visible set. `ContainerStat` (`internal/container/types.go:206-215`) carries only an ID and
metrics — no host — while the visible set is naturally per host. A plausible fix gates stats
on the event's host and silently drops the whole stat channel; the correct fix has to match a
host-less payload by ID across every joined host. Coupled must-keep-working: stats for a
visible container keep flowing, including a visible container on a *second* host, and a
container that starts while the caller is connected refreshes the visible set before it is
gated. Also coupled: a raw `update` event can carry a nil `Container`; an eager check must not
panic and disconnect the stream.

## Far sites / levers, each with a different reason to dismiss

1. **T1 events stream channels (real upstream; published-fix sites).**
   After the stat case, the same select forwards `container-event` (start/die/destroy/rename/
   pause/unpause), `container-updated`, `container-health` and the `containers-changed`
   refresh, none gated. Reason to dismiss: the report names the statistics stream, so the
   other notification channels look like metadata, not container data. Shape: health has the
   identity only in `actorId`; update carries a whole `*Container` that may be nil.
2. **T2 notifications preview (real upstream route the published fix never touches).**
   `internal/web/notifications.go:572` lists with `container.ContainerLabels{}` and returns
   `matchedContainers` (full `container.Container` including its stats ring buffer) plus
   matched logs to any authenticated caller. Reason to dismiss: it is a rule-authoring /
   preview surface for administrators, not a container view. Reachable by any authenticated
   user; no role check in the handler.
3. **T3 MCP tools (real upstream, separate package, opt-in).**
   `internal/mcp/server.go:105` (`list_containers`), `:324` (`get_container_stats`) and `:165`
   (`get_container_logs`) call the host service with the server-wide `h.config.Labels`
   (`internal/web/routes.go:222`); the caller's `ContainerLabels` never reach the tool.
   Reason to dismiss: MCP is disabled by default and documented as a server-wide
   "all containers across all hosts" integration, so per-account filters look out of scope.
4. **T4 debug store (real upstream, debug-gated route).**
   `internal/web/debug.go:13` lists with `container.ContainerLabels{}` and returns every
   container as JSON. Reason to dismiss: it is mounted only when debug logging is enabled, so
   it reads as a diagnostic tool rather than a user surface.
5. **T5 injected sibling — an OOM channel in the same select (events.go).**
   A plausible maintainer extension: Docker emits an `oom` container event, and the server
   forwards `container-oom` with `actorId` and `host` without any visibility check. It is real,
   reachable through the same SSE entry point (`ContainerClient.ContainerEvents` forwards every
   container action), and the published fix never touches it. Reason to dismiss: it is a
   state-change notification carrying an identifier, not a stats/list payload, so it looks like
   it is outside the "container telemetry" the report describes.

All five are covered by the single property. None is described in `instruction.md`.

## Candidate list (everything found, including candidates not used)

Real upstream routes/sites:
- `internal/web/events.go:63-108` — stat, lifecycle, update, health, containers-changed refresh
  (the landing point and published-fix sites).
- `internal/web/notifications.go:572,595` — preview lists and finds with empty labels.
- `internal/mcp/server.go:105,165,324` — tools built with server-wide config labels.
- `internal/web/debug.go:13` — lists with empty labels; mounted under debug logging.
- `internal/cloud/tools_containers.go:53,80,98,113` and `tools_resolve.go:145` — cloud tool
  surface with `deps.Labels`; driven over the cloud gRPC connection, not a local user route.
  Not used.
- `internal/agent/server.go:82,105,132,316,330,403,424` — agent gRPC server resolves with empty
  labels; trusted internal port behind certs. Not used.
- `internal/healthcheck/rpc.go:17` — healthcheck RPC lists with empty labels; internal. Not used.
- `internal/notification/log_listener.go:182,192` — receives labels from its caller; not a
  per-request user surface. Not used.
- `internal/docker/stats_collector.go:104,131` — starts stats for any `start` event without
  re-checking labels. This is the producer upstream of the web sink, but the sink check alone
  closes every tested route (the check never calls the producer), so under the design rules it
  is not a valid lever. Recorded as out of scope, not pursued.
- `internal/web/logs.go`, `terminal.go`, `actions.go`, `download.go` — already resolve the
  caller's labels. No gap.
- MCP `list_hosts` returns host metadata, not container data; outside the property.

Injection rooms considered:
- Sixth SSE branch (OOM) in the events select — **picked** (T5).
- A new container search/snapshot route using `h.config.Labels` instead of the caller's
  labels — plausible wrong-authority mistake; not picked because it is a where-type extra and
  adds a route the report already covers by the same grep.
- A new log/stat stream route copying `h.config.Labels` (O8b lead) — same shape as above; not
  picked.
- Another preview/diagnostic endpoint listing with empty labels — duplicates T2/T4; not picked.
- A new MCP tool registered with `s.labels` — redundant once T3 is fixed; not picked.

Picks: T1 (main, how-type), T2, T3, T4 (real routes with three different dismissal reasons),
T5 (injected, how/where mix, different reason). T5 beats the other injection rooms because it
sits inside the same select the solver is already editing, is produced by the real event stream
with no producer change, and is easy to miss when a solver patches only the channel names the
report implies.

## Sites/routes/input shapes the security tests cover

- SSE stat for a hidden container; visible stat sentinel (same host, and a second host).
- SSE lifecycle (`die`) for a hidden container; visible sentinel; hidden `start` refresh.
- SSE `update` for a hidden container; visible sentinel.
- SSE health for a hidden container; visible sentinel.
- SSE injected `oom` for a hidden container; visible sentinel.
- `POST /api/notifications/preview` with `containerExpression: "true"` for a restricted caller.
- MCP `list_containers` and `get_container_stats` for a restricted caller (over the real
  streamable-HTTP mount, real auth headers).
- `GET /api/debug/store` for a restricted caller (debug logging enabled).

## Coupled must-keep-working behaviour (functional tests)

- Restricted caller keeps receiving stats for its own containers, on the local and a second
  host; the host-less stat must still bind.
- Restricted caller keeps receiving lifecycle, update, health and OOM notifications for its own
  containers, with event names and payload shapes unchanged.
- A container that starts while the caller is connected appears in `containers-changed` and its
  `start` event is forwarded (refresh before gate).
- The initial `containers-changed` list stays filtered and keeps both permitted containers.
- A raw `update` event with no container payload does not disconnect the stream.
- Unrestricted callers can still preview rules, use the MCP tools and read the debug view.
- The project's own `internal/mcp` and `internal/auth` tests keep passing (pristine restore).

## Verified

- The claimed flaw reproduces through the real HTTP router at the pinned commit: all 11 security
  tests fail and all 12 behavioural functional tests pass (also with the injected OOM branch).
- Every route is reachable through the real router with the real forward-proxy authentication
  middleware and a `team=red` filter; the host service is a per-resource stub, as the design
  requires.
- Oracle: all security and functional tests pass. Wrong-fix patches behave as declared locally:
  `miss_stat`, `miss_events`, `miss_oom`, `miss_preview`, `miss_mcp`, `miss_debug` and
  `crash_as_refusal` fail only security; `overbroad_refresh` and `refuse_all` fail functional;
  `hardening` and `alt` score 1.0.
- Project tests pass at the pinned commit and on the oracle: `go test ./internal/web` (the happy
  event-feed test restored with its coupled-behaviour mock), `go test ./internal/mcp ./internal/auth`
  (54 cases).
- The injected OOM branch is produced by the real Docker event path
  (`internal/docker/client.go:374` forwards every container action), so it needs no producer
  change and is reachable through the same feed.
- Build-time network only: module cache, Node and the agent layer are baked into the image; the
  verifier runs offline.

## Gate results (2026-10-28)

- static: PASS (conformance "conforming"; no instruction leaks; all declared patches present except
  the downstream blind patch).
- nop: PASS - 11 security tests fail on the pinned+injected tree, 67 functional tests pass
  (12 behavioural + 1 restored project web test + 54 project mcp/auth cases).
- oracle: PASS - 3 identical trials, reward 1.0, 11/11 security and 67/67 functional in each.
- patches: PASS 11/11 as declared. `miss_stat`, `miss_events`, `miss_oom`, `miss_preview`,
  `miss_mcp`, `miss_debug` and `crash_as_refusal` fail only security with all functional green;
  `overbroad_refresh` and `refuse_all` fail functional; `hardening` and `alt` score 1.0.
- Stage logs: `build/dozzle-s4/{nop,oracle,patches}-run.log`; static in
  `build/dozzle-s4/gate_report.partial.json` at the time it ran. Trials are under
  `~/.tb-graders/cwe/gate-jobs/dozzle-s4-*`.
- Environment cap here was `GATE_GLOBAL_SLOTS=2`, so the patches stage ran in batches.
- The pinned commit contains no regression test for the advisory (`git log b38117bf..19c01e0f` is
  the single fix commit; the added filtered test is absent at the pinned parent).

## Not verified / unknowns

- Behaviour on real Docker hosts was not exercised; the tests stub the host service per
  resource, which is the design's required per-resource permission stub.
- No upstream release tree was supplied; a read-only look at current master shows the
  per-caller filter has since been applied to the debug, preview and MCP routes, so the gap is
  not present in latest (the routes are).
- The screener's MCP/notification reachability claims were confirmed by reading routes and
  auth wiring, not with a running server before this build; the behavioural tests verify them.
