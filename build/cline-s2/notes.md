# cline-s2 — build notes

- Start (UTC): 2026-10-27T19:10:37Z
- End (UTC): 2026-10-27T20:28:00Z (gate stages finished)
- Candidate: screener entry 7872, cline/cline, pinned `23c9bf1c05bfb116e843d18e1268304b00131e69`,
  published fix `d09270940f5746f288cfc4a5039b46a2f4d5d01e`.
- Advisory family: GHSA-3CJ3-HQCR-G934 / CVE-2026-59723 (CWE-346 / CWE-1385).
- Pattern A+B, injected track, strict gate.
- Environment: `node:22-bookworm-slim` plus the official Bun 1.3.13 binary (copied from
  `oven/bun:1.3.13`); the product servers run under Bun, the verifier's vitest runs under Node
  because vitest 4 under Bun mis-resolves the shared package's zod dependency.

## Security property (written once, before routes)

No local service may perform an agent-runtime action (drive a session, read or change provider,
MCP, tool or session configuration, restart the runtime) for a request unless the request comes
from a page the deployment itself serves: its host must name the deployment, its origin must be an
address the deployment is configured to serve, and a missing, empty or unparseable origin is
refused with a client error before any action, state change or reply. Serving the dashboard's own
pages and public resources is not an action and stays origin-free. Configured public addresses keep
working with or without the listening port; a tunnel hostname keeps its portless form. The
instruction states this invariant and the preservation clauses once, and names no route.

## Levers (one line each)

1. **L1 (A, reported site, where).** The dashboard's browser socket accepts a WebSocket upgrade
   from any origin, no origin, an unparseable origin, another local port, another scheme, or a
   foreign host. `apps/cline-hub/src/server.ts:87` at the pinned commit; the reference gates every
   request at `apps/cline-hub/src/server.ts:101`. Dismiss: fixing the reported socket is the
   obvious change.
2. **L2 (A, how-type producer + coupled value).** The allowlist is built from the configured
   public address; `normalizePublicUrl` does not add the listening port for a bare machine address,
   so the browser's real origin (`http://100.82.5.118:<port>`) does not match, while a tunnel
   hostname must not gain a port. `apps/cline-hub/src/options.ts:33-51,90-110`. Dismiss: the
   configured address looks authoritative; always appending the port fixes the first case and
   breaks the tunnel.
3. **L3 (A, coupled must-keep-working).** Public page/asset/version/health/config delivery must
   stay origin-free (`isWebviewRoute` + public path set), so a blanket origin requirement breaks
   the dashboard itself. Dismiss: stricter looks safer.
4. **L4 (B, real upstream second implementation).** The desktop application's browser bridge
   upgrades `/transport` with no origin/host check and dispatches the same privileged commands.
   `apps/examples/desktop-app/sidecar/server.ts:87`. Dismiss: example app, localhost-only, no
   invite secret, and the report names the dashboard; a same-origin-only check also breaks its
   development page. Current upstream HEAD (943d6284) later added a trusted-origin allowlist at
   this exact upgrade, confirming it was a real gap.
5. **S1 (injected, how-type shape).** A second WebSocket at `/settings/live` reuses the shared
   peer registry and command-frame handler; its path is classified as public page content by the
   dashboard's own predicate. `apps/cline-hub/src/server/live-settings.ts` wired at server.ts.
   Dismiss: it reads as a settings-page stream; a public-exemption-first check leaves it open.
6. **S2 (injected, second transport).** A `POST /api/desktop-command` fallback calls the same
   desktop command dispatcher. `apps/cline-hub/src/server/desktop-command-api.ts` wired at
   server.ts. Dismiss: an internal/scripted HTTP fallback; a common belief is that a cross-site
   POST cannot do anything without a readable response.

Different dismissals: reported socket; authoritative config/producer; stricter-is-safer; example
app; public page content; internal HTTP fallback. How-type levers: L2 (producer off the check's
path + coupled value), L3 (public/upgrade distinction), S1 (path predicate ordering), S2 (verb
transport).

## Sibling candidate list (every candidate found, then the picks)

- `apps/cline-hub` `/browser` — the reported landing point, not a sibling (L1).
- `apps/cline-hub` `POST /api/desktop-command` — **picked S2**: a real second transport into the
  same dispatcher, far from the reported socket, and a fix that only guards upgrades misses it.
- `apps/cline-hub` `/settings/live` WebSocket — **picked S1**: the strongest candidate, because its
  path is deliberately public-classified by the product's own page predicate; it turns the public
  exemption into a how-type ordering problem rather than another plain route.
- `apps/cline-hub` a second upgrade at `/events` or `/terminal` — rejected: same concept as S1 with
  no public-path interaction, i.e. a pure where-type extra.
- `apps/cline-hub` a second consumer of the configured public address (invite/QR endpoint) —
  rejected: no privileged sink; the producer lever L2 is already exercised through the real
  browser origin and through the HTTP command endpoint.
- `apps/cline-hub` a route where the guard runs after a side effect — rejected: would require
  deliberately misordered product code, which is not a plausible maintainer mistake here.
- `apps/examples/desktop-app/sidecar` `/transport` — **picked L4** (pattern B): a real, unmodified
  second implementation of the same browser-to-desktop command bridge in another workspace
  package; the published fix never touches it.
- `apps/examples/desktop-app/sidecar` `POST /shutdown` — rejected: lifecycle endpoint rather than
  an agent-runtime action, and its native caller sends no origin; confirmed open at the pinned
  commit and recorded in the audit register, not built.
- `sdk/packages/core/src/hub/server/hub-websocket-server.ts` `isLocalHubOrigin` — rejected: the
  hub already validates origins, permits any loopback origin intentionally, and the project's own
  test asserts `http://localhost:3000` is trusted; a different package and a different sink.
- `sdk/packages/core` hub HTTP `/status`, `/shutdown` — rejected: bearer-token authenticated.
- `apps/cli/src/connectors/chat-runtime.ts` HTTP server — rejected: a connector webhook, not the
  desktop command sink.
- `apps/examples/multi-agent`, `apps/examples/code-review-bot`, `apps/examples/vscode` servers —
  rejected: example webhook/daemon servers with a different sink and no browser command surface.
- `apps/vscode` OAuth callback / external auth handler — rejected: an OAuth callback listener, not
  a command surface.
- `apps/cline-hub/src/webview/vite.config.ts` `Access-Control-Allow-Origin: *` — rejected:
  development asset server only, no privileged operation.
- A wrong-object sibling (authorise a caller-supplied session id instead of the object written) —
  rejected: the dashboard has no per-object authorisation to mirror; it would be artificial.
- A merged/default-origin configuration route — rejected: the dashboard's origins come only from
  environment configuration; a merge route would be artificial.

Picks beat the others because they are the most complex and least route-shaped: S1 needs the
public-page/upgrade distinction understood, S2 needs the unsafe-method transport understood, and
L4 is a real second implementation in another package. The other candidates are either another
route of one concept, a different sink, or intentionally permissive code with project tests.

## Pre-trial fairness revision (2026-10-28)

- Applied FAIRNESS.md "Required: generalize" 1-6: removed the front-end/operation checklist, the
  socket/command-frame/provider-settings mechanism, the public-resource variant list, the
  local-port and public-address variant lists, and the "different connection or way of asking"
  enumeration. The preserved clauses now state one general property over the protected outcome.
- Resolved the AUDIT-FINDINGS r1 ambiguity: the address rule now states that an address is the
  deployment's own only when its scheme, host and port are its own, with one carve-out for a front
  end the product itself ships and serves. A dashboard origin on the same machine but another
  port or scheme is therefore refused, consistent with the `dashboard_socket` wrong-port and
  wrong-scheme cases; the desktop bridge development page stays accepted through the carve-out.
- Extended the security suite with empty Origin (dashboard and bridge), a second foreign origin,
  a trusted-name lookalike origin, and a valid invite secret plus a foreign origin on the live
  settings socket and the HTTP command endpoint.
- Not applied (Quality, non-Required): a missing-Host case (Bun may reject a Host-less HTTP/1.1
  request before product code runs, so the nop baseline would not reliably fail it) and sidecar
  wrong-scheme/wrong-port cases (the reference bridge is intentionally permissive there; adding
  them would require extending the oracle and every pass patch). The universal host claim stays
  because a stricter fix that validates Host on the bridge still passes every test.

## Sibling-injection §2 upgrade (2026-10-28)

- Instruction-only change. The security property is still stated once, but the remaining
  variant enumerations and surface hints were removed: the no-origin/empty-origin/unparseable-origin
  list became "does not present a usable origin naming an address the deployment is configured to
  serve"; "even when that front end and the service bind different local ports" became "in whatever
  address form that front end presents"; "including when the configuration omits the listening port"
  was dropped (the preceding "whatever form clients and the configuration present it" covers it);
  the impact sentence no longer names the reported front end.
- Levers unchanged: L2 is the M6 producer (`normalizePublicUrl`/`shouldAddDashboardPortToPublicUrl`
  in `options.ts`) plus the M11 coupled bare-address/tunnel values; L3 is the M11 public-page
  delivery contract; L4 is a real M2 second implementation and an M4 route that never had the
  protection. S1 is the public-path/upgrade ordering shape and S2 the second transport.
- Coverage unchanged and complete: the four covered routes (dashboard `/browser`,
  `/settings/live`, `POST /api/desktop-command`, desktop bridge `/transport`) each have security
  cases and a coupled functional case; the bridge is the upstream route the published fix left open.
  No test, oracle or check patch was changed, so no image rebuild and no container re-gate is needed.
- `manifest.leak_terms` now also rejects the reported front end's product name, so a future edit
  cannot reintroduce the pointer.

## Gate results

- static: pass.
- nop: pass - 24/24 security cases fail and 12/12 hidden functional plus 59/59 project cases pass on the planted tree.
- oracle: pass - 3/3 runs reward 1.0 with identical results (24/24 security, 71/71 functional).
- patches: pass - 15/15 as declared (miss_base/miss_sidecar/miss_live/miss_posts/crash/wrong_resource/malformed/missing_secret security_fail with functional clean; miss_port/always_port/overbroad/refuse_all functional_fail; hardening, alt_fix and blind 1.0).

## Verified

- Pinned+injected tree (environment image content): 24/24 security cases fail (all assertion
  failures, no harness errors), 12/12 hidden functional and 59/59 project cases pass.
- Reference fix (published source changes + desktop bridge guard): 24/24 security, 12/12
  functional, 59/59 project pass.
- Every check patch behaves as declared (validated in an offline node+bun container against the
  same restored-workspace layout the verifier uses): miss_base 12 security failures, miss_sidecar
  6, miss_live 3, miss_posts 3, miss_port 2 functional failures, always_port 1 functional failure,
  overbroad/refuse_all functional failures, crash/wrong_resource/malformed/missing_secret security
  failures, hardening, alt_fix and blind all pass.
- The bare-address producer case was reproduced through the real listener: with
  `PUBLIC_URL=http://100.82.5.118` and the dashboard on a dynamic port, the reference (with the
  port normalisation) upgrades and the no-normalisation variant returns 403; the tunnel case is
  the opposite (always-appending returns 403).
- Offline: the dashboard attaches to a local detached hub daemon and the bridge starts with a
  stub context; both were exercised with `--network none`.
- The pinned commit has no `apps/cline-hub/src/server/browser-auth.test.ts`; the environment
  Dockerfile asserts its absence.

## Could not verify

- The packaged Tauri webview origin is not exercised; the functional sidecar case uses the
  development page origin (`http://localhost:3125`) from `tauri.conf.json`. The reference guard
  also accepts `tauri://localhost`.
- The reference also adds an origin check to `/shutdown`, but the native caller sends no origin;
  it is not exercised or required.
- Repository size, current-release status beyond the read-only HEAD check, and the screener's
  `present_in_latest` values for the dismissed routes were not otherwise explored.
- The environment image's 2.5 GB dependency tree is large; build time is the main cost.

## Out of scope (one line)

Only read (never exercised) the SDK hub websocket server, the CLI connector server and the other
example listeners to compare the origin-check idiom; nothing outside the dashboard listener and the
desktop application's browser bridge was run or probed, and the reference does not modify them.

## Pattern B register

Rows appended to `build/audit/uncovered-routes.tsv`: the desktop bridge `/transport` upgrade
(L4, built), the desktop bridge `POST /shutdown` (confirmed open, not built), and the SDK hub
loopback-origin acceptance (inspected, intentional and project-tested, not built).
