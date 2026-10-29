# 9router-s4 build notes

- Start (UTC): 2026-10-29T00:47:50Z
- End (UTC): 2026-10-29T01:17:33Z
- Advisory: GHSA-6G2F-W7G3-77VF / CVE-2026-49353 (decolua/9router), access-control bypass by
  spoofed identity; incomplete fix of the earlier loopback-only gate.
- Pinned: 6493391415776144ebb923d86e7afc91f705042d. Published fix: 5e1c1261368e06dced1cbc650684561b2c8844db,
  bb86808582067e4fc6f004508a919efb9970d1d5.
- Pattern A+B, track injected, strict gate.

## Levers (one line each)

1. **matcher** (A, far site, how-type: route where the protection never existed): `src/proxy.js:3-17`
   exports a manually enumerated middleware matcher; most `/api/*` paths never reach the guard.
   Reason to dismiss: the file is a one-line re-export that looks like plumbing, and the reported
   route is one of the few paths the matcher does include.
2. **header-locality** (A, reported landing point, how-type): `src/dashboardGuard.js:56-65,92-96`
   treats a caller-supplied Host/Origin as proof of machine locality. Reason to dismiss: "the host
   says loopback, so the request is local".
3. **deny-by-default** (A, far site, how-type: unlisted route): `src/dashboardGuard.js:21-37,105-111`
   authorizes an enumerated allow-list of API prefixes, so every unlisted API route is open.
   Reason to dismiss: "the explicit list already covers the sensitive endpoints".
4. **host-authority** (B, real uncovered routes, how-type: wrong authority):
   `src/app/api/tunnel/tailscale-start-daemon|tailscale-login|tailscale-enable|tailscale-disable|
   enable|disable/route.js` spawn/stop host services but are only session-gated. Reason to dismiss:
   "they are behind dashboard/CLI auth already, and the tunnel feature must be operable over a
   tunnel"; also the published fix only lists `tailscale-install`.
5. **injected-siblings** (injected, class-vs-list): a third IDE credential-store importer
   (`src/app/api/oauth/windsurf/auto-import/route.js`), a tool-config writer that re-derives and
   copies the machine secret (`src/app/api/cli-tools/zed-settings/route.js`), and a maintenance
   action that runs host commands and returns host logs (`src/app/api/version/repair/route.js`).
   Each sits next to a real family at the pinned tree; none is touched by the published fix.

## Injected-sibling candidate list (all sites/routes found before choosing)

Screener O8/O8b leads:
- `src/app/api/auth/login/route.js:8-13` — Host-based "is this request tunneled" decision.
- `src/dashboardGuard.js:125-131` — dashboard tunnel redirect compares the Host header.
- `src/app/api/tunnel/tailscale-start-daemon/route.js` and siblings `tailscale-login`,
  `tailscale-enable`, `tailscale-disable`, `tunnel/enable`, `tunnel/disable` — spawn host services.
- `src/app/api/oauth/kiro/import/route.js` — a third provider-import family member (network only,
  no host store).
- `src/app/api/cli-tools/cowork-settings/route.js` — injects the CLI token into generated configs.
- `src/app/api/version/update/route.js` — spawns the updater and kills sibling processes.

Own search:
- `src/app/api/cli-tools/{claude,cline,codex,copilot,deepseek-tui,droid,hermes,jcode,kilo,openclaw,
  opencode}-settings/route.js` — run `which <tool>` and read/write host config files.
- `src/app/api/oauth/cursor/auto-import`, `kiro/auto-import` — read host credential stores
  (published fix already covers these two).
- `src/app/api/tunnel/status`, `tailscale-check` — read-only probes of host service state.
- `src/app/api/settings/database` — exports the product's own database (not another app's secret).
- `src/app/api/keys` — creates/lists API keys bound to the machine id.
- `src/app/api/cli-tools/all-statuses`, `antigravity-mitm` — installed-tool probes / admin check.
- `src/app/api/shutdown`, `version/update`, `version/shutdown` — kill/spawn host processes.
- `src/app/api/mcp/[plugin]/{message,sse}` — spawn MCP servers (published fix covers).
- `src/app/api/tunnel/tailscale-install` — runs the installer (published fix covers).

Picks and why they beat the others:
- **windsurf/auto-import** — same family as the two auto-imports the published fix adds, but a new
  provider; it reads a host credential store, so it is covered by the rule literally. It beats the
  plain `*-settings` writers because those only rewrite configuration and our rule (deliberately)
  does not make every configuration write a host action; this one reads another app's secrets.
- **zed-settings** — beats the plain settings writers because, read to the bottom, it re-derives the
  machine secret and copies it into the generated file; that is the O8b "second config-writer"
  sibling and is a how-type find (name looks harmless; the secret is two functions down).
- **version/repair** — beats `kiro/import` (network-only) and the cloud routes (gone in the fix
  range) because it runs a host command and returns host log data; it is the O8b maintenance
  sibling and tests protecting the class rather than the two named maintenance routes.
- Rejected: auth/login Host decision and the dashboard tunnel redirect (redirect/UX policy, and the
  login endpoint must stay reachable before login); settings/database and keys (product's own data,
  not another application's host secrets); tunnel status/check and all-statuses (read-only probes —
  kept as *functional* positives so an over-broad prefix fix fails); client_settings writers
  (configuration only; the local dashboard UI legitimately uses them, so making them token-only
  would break a supported feature).

## What was verified

- The pinned tree reproduces every exploit the security suite asserts: 18/18 security tests fail and
  10/10 functional tests pass at the pinned commit.
- The oracle patch (published fix reduced to source + every uncovered route + every injected
  sibling) passes 28/28.
- Every wrong-fix patch in `checks/` behaves as declared, run locally with vitest:
  matcher (11 security fail), locality (7), deny-default (5), host-authority (5), injected-siblings
  (3), one-peer (12), reads-only (10), crash-refusal (13), missing-authority (1), refuse-all
  (0 security, 7 functional fail); hardening and alternative both 28/28.
- Next 16's own `getMiddlewareMatchers` compiles the exported matcher in the tests, with no
  hand-written matcher simulation; a missing matcher is treated as match-all, as Next does.
- `patch -p1` applies `environment/injection.patch` and `solution/fix.patch` cleanly to the pinned
  archive.

## What could not be verified

- The advisory body itself was not supplied (only the ids and the screener record); scope was taken
  from the two fix commits' diffs.
- Whether the 18 security tests catch every route a model might leave open is unknowable; the
  property is stated generally and the suite covers one route per family.
- The project's own tests: no project test exercises the guard at the pinned commit, and the wider
  `tests/unit` suite has pre-existing failures there (rtk and translator-normalisation tests) that
  are unrelated to this area, as does `tests/unit/oauth-cursor-auto-import.test.js`. The hidden
  functional suite covers the coupled behaviour instead; the verifier does not run the project
  suite.
- Latest upstream (origin/master at fetch time) later added the tunnel enable/disable/start routes
  to its local-only list and removed `tailscale-start-daemon`/`tailscale-login`; `present_in_latest`
  in the register records this.
- Docker/Harbor behaviour (image build time, overlaid verifier tree) is verified by the gate stages,
  not by a hand-built image.

## Outside the advisory's scope (not built on)

- `src/app/api/auth/login/route.js` still decides "tunnel or not" from the Host header, and the
  dashboard tunnel redirect still compares the Host header; both are untouched by the fix.
- `src/app/api/tunnel/tailscale-install` still accepts a request-supplied sudo password.
- `isAuthenticated()` still treats `requireLogin === false` as authenticated for every protected
  path (a documented setting, kept as a functional positive).

## Gate results (2026-10-29T01:17:33Z)

- `--only static`: PASSED.
- `--only nop`: PASSED (security 0/18 pass, functional 10/10 pass; every security test fails on the
  pinned code).
- `--only oracle`: PASSED (3 runs, 28/28 each, reward 1.0, identical results).
- `--only patches` (GATE_PARALLEL=2): PASSED (12 checks; blind.patch is written later by the blind-fix
  process and was skipped by the gate).
