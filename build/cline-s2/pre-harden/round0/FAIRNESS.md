# cline-s2 — pre-trial fairness review

## 1. Test-by-test fairness

Covering sentences are quoted from `tasks/cline-s2/instruction.md` ("P" = the Security-property paragraph, lines 18–22; "E" = "The examples above are examples… every way a request can reach one of these services", lines 37–38; "K" = "Everything that works today must keep working", line 28).

### Security suite

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| dashboard_socket::refuses … another site | `/browser` upgrade, foreign Origin → 4xx | P: "origin is not an address the deployment is configured to serve … must be refused" | no — any 4xx; dispatcher-level or branch-level guard both pass | low |
| dashboard_socket::… no origin | upgrade without Origin → 4xx | P: "a request that presents no origin … must be refused" | no | low |
| dashboard_socket::… unparseable origin | `Origin: null` → 4xx | P: "or an unparseable origin — must be refused" | no | low |
| dashboard_socket::… right machine on another port | Origin `http://127.0.0.1:9999` → 4xx | P: exact property; the different-port clause (line 31) names "the product's own local front end", not arbitrary loopback origins | no — see Human review | medium |
| dashboard_socket::… another scheme | `https://` origin → 4xx | P: "an address the deployment is configured to serve" (scheme is part of origin) | no | low |
| dashboard_socket::… host names another site | foreign Host → 4xx | P: "A request whose host does not name the deployment must likewise be refused." | no | low |
| dashboard_shared_address::invite holder, another site | valid secret + foreign Origin → 4xx | P (origin) | no — secret alone is not sufficient | low |
| dashboard_shared_address::invite holder, no origin | valid secret, no Origin → 4xx | P (no origin) | no | low |
| dashboard_shared_address::invite holder, foreign host | public Origin + foreign Host → 4xx | P (host) | no | low |
| dashboard_http_command::command from another site | POST foreign Origin → 4xx, no `"ok":true` | P + line 42: "must not bypass the check by using a different … way of asking" | no | low |
| dashboard_http_command::command without origin | POST no Origin → 4xx | P (no origin) | no | low |
| dashboard_live_socket::another site | `/settings/live` upgrade foreign Origin → 4xx | E: property applies to "every way a request can reach one of these services"; an upgrade is not "Serving … pages" (line 24) | no — see Human review | medium |
| dashboard_live_socket::no origin | upgrade no Origin → 4xx | E + P | no | medium |
| sidecar_transport::another site | `/transport` foreign Origin → 4xx | line 3–6 names "a desktop application"; E | no | low |
| sidecar_transport::no origin | upgrade no Origin → 4xx | P (no origin) | no | low |
| sidecar_transport::unparseable origin | `not a url` → 4xx | P (unparseable) | no | low |

### Functional suite

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| dashboard_trusted_connections::dashboard page's own socket | same-origin `/browser` → 101 | line 30: "a connection from the dashboard's own page must still be accepted" | no | low |
| dashboard_trusted_connections::settings page's live socket | same-origin `/settings/live` → 101 | line 30 + K | no | low |
| dashboard_trusted_connections::command posted by the dashboard page | same-origin POST → 200 `"ok":true` | K | no | low |
| dashboard_public_address::shared machine address with no port | bare IP config, browser adds port → 101 | line 33–35: "a bare machine address with no port … must keep working" | no | low |
| dashboard_public_address::replayed commands through that address | same, POST + secret → 200 | K + line 33–35 | no | low |
| dashboard_public_address::tunnel hostname with no port | `PUBLIC_URL=https://tunnel.example` → 101 | line 34–35: "a tunnel hostname that deliberately carries no port" | no | low |
| dashboard_public_pages::version | no-origin `/version` → 200 | line 25–26 names "version … must keep loading for a browser that sends no origin" | no | low |
| dashboard_public_pages::config | no-origin `/config.json` → 200 | line 25–26 names "configuration" | no | low |
| dashboard_public_pages::health | no-origin `/health` → 200 | line 25–26 names "health" | no | low |
| dashboard_public_pages::dashboard page | no-origin `/` → 200/503 | line 25: "The dashboard page … must keep loading" | no | low |
| dashboard_public_pages::sub-page | no-origin `/settings` → 200/503 | line 25: "its sub-pages" | no | low |
| sidecar_trusted_connections::desktop dev page | Origin `http://localhost:3125` → 101 | line 31–32: "front end … served from a different local port than the service it connects to" | no | low |

### Project suite (restored pristine; all cases count in the functional group)

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| project/http.test.ts (23 cases) | `isWebviewRoute` SPA routes, asset exclusion, index rewrite/theme | K; pre-existing repo tests visible to the solver | no — reference passes; only a gratuitous export removal breaks it | low |
| project/connectors.test.ts (6) | CLI launch/error normalisation | K | no | low |
| project/marketplace.test.ts (26) | installer/desktop-command helpers | K | no | low |
| project/user-instructions.test.ts (1) | plugin package name | K | no | low |
| project/desktop-client.test.ts (3) | browser transport failures | K | no | low |

## 2. Leniency — wrong fixes vs. traps

| Trap / property | Most plausible wrong fix | Caught? |
|---|---|---|
| L1 reported socket | gate only the `/browser` upgrade branch | yes — live_socket, http_command, sidecar_transport catch the siblings (`miss_live`, `miss_posts`, `miss_sidecar`) |
| L1 refusal form | throw / abort instead of returning a client error | yes — all security rows require 4xx (`crash.patch`) |
| L2 producer | use configured `PUBLIC_URL` verbatim, no port for a bare address | yes — `dashboard_public_address` bare-address rows (`miss_port.patch`); `always_port.patch` breaks the tunnel row |
| L3 public delivery | require an Origin on every request | yes — `dashboard_public_pages` + harness readiness (`overbroad.patch`); `refuse_all.patch` too |
| L4 desktop bridge | fix only the dashboard listener; or use same-origin-only on the bridge | yes — `sidecar_transport` (`miss_sidecar.patch`); same-origin-only fails `sidecar_trusted_connections` |
| S1 live socket | consult the public-route predicate before the upgrade flag; or guard only `/browser` | yes — `dashboard_live_socket` (`miss_live.patch`) |
| S2 HTTP command | guard only WebSocket upgrades / safe methods | yes — `dashboard_http_command` (`miss_posts.patch`) |
| invite secret as authority | authorise on `roomSecret` alone | yes — `dashboard_shared_address` + `dashboard_socket` (`wrong_resource.patch`) |
| malformed identity | treat unparseable Origin as trusted | yes — `dashboard_socket` + `sidecar_transport` (`malformed.patch`) |
| missing authority | fail open when no secret is configured | yes — default-env security rows (`missing_secret.patch`) |

Wrong fixes **no test catches**: (i) trusting a request with no `Host` header; (ii) on the sidecar, accepting any loopback scheme/port (only foreign domain / missing / unparseable are tested — the reference itself is permissive here); (iii) treating an **empty** `Origin: ` as trusted (named in the instruction, never sent); (iv) a lookalike allowlist (`*.localhost`, `localhost.evil.example`); (v) a valid `roomSecret` plus foreign Origin on `/settings/live` and `/api/desktop-command` (only `/browser` is covered); (vi) a denylist/hardcoded attacker string (all security rows share one foreign-origin literal; not maintainer-realistic from a blind solve).

## 3. Realism

All six traps are code a maintainer could write and are reachable through the real entry points: L1–L3 are unmodified upstream sites, L4 is real upstream code the published fix never touched (and which upstream later hardened), and S1/S2 are plausible siblings (a settings stream reusing the peer registry; a scripted HTTP command fallback). Nothing looks planted. No realism flags.

## 4. Verdict

**READY.** Every hidden test asserts what P, E or the preservation clauses state and drives the real listening sockets; security rows accept any 4xx (no specific class or status), functional rows assert the explicitly preserved 101/200. Generic gates at the dispatcher, in the upgrade branch, or at the option loader all pass; the reference and `alt_fix` both score 1.0, and `hardening` stays 1.0. The only judgment calls are the scoping of the "different local port" clause and whether a `/settings/live` upgrade is "serving a page" — both resolve to "no" under the primary stated mechanism.

### Required: generalize

1. "Its front ends — a terminal, editor integrations, a browser dashboard, and a desktop application — talk to local services over HTTP and WebSocket connections to show sessions, change provider and MCP settings, drive agent turns, and restart the local runtime." → "Its front ends talk to local services to run and configure agent sessions." (drops the component/operation checklist that maps to L1/L4/S1/S2).
2. "…can open a WebSocket connection to the dashboard's loopback address and send a command frame. The dashboard accepts the connection and performs the command … for example, returning the local provider settings…" → state the impact over the outcome: "a page not served by the deployment can make the local runtime perform privileged actions."
3. "The dashboard page, its sub-pages, and its public version, health, configuration and asset responses must keep loading…" → "The deployment's own pages and the public resources they load must keep loading for a browser that sends no origin, exactly as they do today."
4. "a connection from the product's own local front end must still be accepted when that front end is served from a different local port than the service it connects to" → "a connection from a front end the product itself supplies keeps working, even when it and the service bind different local ports."
5. "whether that address is a bare machine address with no port, an address that includes the listening port, or a tunnel hostname that deliberately carries no port" → "in whatever form clients and the configuration present it, including when the configuration omits the listening port."
6. "must not bypass the check by using a different connection or a different way of asking" → "must not bypass the check regardless of how the request arrives."

No other general word collides with an entry-point name ("browser" is the generic web browser, not the `/browser` path).

### Quality to tighten

- Add the untested cases above: empty `Origin`, missing `Host`, a second foreign origin, a lookalike `*.localhost` origin, sidecar wrong scheme/port, and a valid secret + foreign origin on the live socket and HTTP command endpoint.
- Add a sidecar Host assertion (the reference validates only Origin there) or drop the instruction's universal host claim.
- Broaden the attacker-origin literals so a denylist cannot pass.

Human review: confirm that the "product's own local front end … different local port" clause is scoped to the desktop dev page and does not license a blanket loopback-any-port allowance on the dashboard, which the `dashboard_socket::another port` security case forbids.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
