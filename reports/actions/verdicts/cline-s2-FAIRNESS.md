# cline-s2 — pre-trial fairness review

Read `instruction.md`, every test file, `solution/fix.patch`, `manifest.json`, `notes.md` and all 15 `checks/*.patch`. Nothing was run; the solver sees only the instruction and the repository.

Covering sentences: **S1** "run or configure an agent session only for a request that comes from a page the deployment itself serves"; **S2** "A request that does not present a usable origin naming an address the deployment is configured to serve must be refused with a client error before any action, state change, or reply"; **S3** "A request whose host does not name the deployment must likewise be refused"; **S4** "an address is one the deployment serves only when its scheme, host and port are the deployment's own; being on the same machine is not enough", save "a front end the product itself ships and serves"; **S5** "Serving the deployment's own pages and the resources they load is not such an action; they must keep loading for a browser that sends no origin"; **S6** "Everything that works today must keep working"; **S7** "the property applies to every way a request can reach one of these services". Every security row takes any 4xx from any guard layer.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| security/dashboard_socket.test.ts::refuses an upgrade whose origin belongs to another site | `/browser` upgrade, foreign Origin → 4xx | S2 | no — any 4xx, any layer | low |
| …::refuses an upgrade that presents no origin | no Origin → 4xx | S2 | no | low |
| …::refuses an upgrade that presents an empty origin | `Origin: ` → 4xx | S2 ("usable origin") | no — empty is not usable | low |
| …::refuses an upgrade whose origin belongs to a second foreign site | attacker.example.net:8443 → 4xx | S2, S4 | no | low |
| …::refuses an upgrade whose origin merely contains a trusted name | `localhost.evil.example` → 4xx | S4 (exact scheme/host/port) | no — S4 states exact host identity | low |
| …::refuses an upgrade that presents an unparseable origin | `Origin: null` → 4xx | S2 | no | low |
| …::refuses an upgrade from the right machine on another port | `http://127.0.0.1:9999` → 4xx | S4 ("being on the same machine is not enough") | no — a loopback-any-port allowlist is excluded by S4 | medium |
| …::refuses an upgrade that uses another scheme | `https://127.0.0.1:<port>` → 4xx | S4 | no | low |
| …::refuses an upgrade whose host names another site | foreign Host, trusted Origin → 4xx | S3 | no — Host may be checked before or after Origin | low |
| security/dashboard_shared_address.test.ts::refuses an invite holder whose page belongs to another site | valid secret + foreign Origin → 4xx | S1, S2 | no — the secret is not authority | low |
| …::refuses an invite holder that presents no origin | valid secret, no Origin → 4xx | S2 | no | low |
| …::refuses an invite holder whose host names another site | public Origin + foreign Host → 4xx | S3 | no | low |
| …::refuses an invite holder on the live socket whose page belongs to another site | secret + foreign Origin upgrade `/settings/live` → 4xx | S1, S7; S5 exempts page delivery, not an upgrade | no — opening the socket is an action | low |
| …::refuses an invite holder on the command endpoint whose page belongs to another site | secret + foreign Origin POST → 4xx, no `"ok":true` | S1, S2, S7 | no — an unsafe verb is an action | low |
| security/dashboard_live_socket.test.ts::refuses a socket opened by another site | upgrade → 4xx | S1, S7 (S5 does not cover upgrades) | no | low |
| …::refuses a socket opened without an origin | upgrade no Origin → 4xx | S2, S7 | no | low |
| security/dashboard_http_command.test.ts::refuses a command posted by another site | POST foreign Origin → 4xx, no `"ok":true` | S1, S2, S7 | no | low |
| …::refuses a command posted without an origin | POST no Origin → 4xx | S2, S7 | no | low |
| security/sidecar_transport.test.ts::refuses a socket opened by another site | `/transport` upgrade foreign Origin → 4xx | S1, S7 | no | low |
| …::refuses a socket opened without an origin | no Origin → 4xx | S2, S7 | no | low |
| …::refuses a socket opened with an empty origin | `Origin: ` → 4xx | S2 | no | low |
| …::refuses a socket opened by a second foreign site | attacker.example.net:8443 → 4xx | S2, S4 | no | low |
| …::refuses a socket opened by an origin that merely contains a trusted name | `localhost.evil.example` → 4xx | S4 | no | low |
| …::refuses a socket opened with an unparseable origin | `not a url` → 4xx | S2 | no | low |
| functional/dashboard_trusted_connections.test.ts::accepts the dashboard page's own socket | same-origin upgrade → 101 | S6 bullet 1 ("requests from a page the deployment itself serves must still be accepted") | no — the bind host on its listening port is the deployment's own | low |
| …::accepts the settings page's own live socket | same-origin `/settings/live` upgrade → 101 | S6 bullet 1 | no — gated, then accepted for the served origin | low |
| …::accepts a command posted by the dashboard page | same-origin POST → 200 `"ok":true` | S6 bullet 1 | no | low |
| functional/dashboard_public_address.test.ts::keeps a shared machine address usable when it has no port of its own | `PUBLIC_URL=http://100.82.5.118`, Origin `http://100.82.5.118:<listener>` → 101 | S4 (own host, own listening port) + S6 | no — adopting the listening port, or accepting configured and listening port, passes | medium |
| …::keeps replayed dashboard commands usable through that address | same address, POST + secret → 200 `"ok":true` | S4 + S6 | no | medium |
| …::keeps a tunnel hostname usable when it intentionally has no port | `PUBLIC_URL=https://tunnel.example`, portless Origin → 101 | S4 (own scheme/host/port = https/tunnel.example/443) | no — always appending the listening port is the wrong fix | medium |
| functional/dashboard_public_pages.test.ts::serves the version document to a browser that sends no origin | `/version` no Origin → 200 | S5, S6 | no | low |
| …::serves the browser configuration to a browser that sends no origin | `/config.json` → 200 `inviteRequired` | S5, S6 | no | low |
| …::serves the health document to a browser that sends no origin | `/health` → 200 | S6 ("works today"), S5 | no — gating it breaks S6 | low |
| …::serves the dashboard page route without an origin | `/` → 200/503 | S5 | no | low |
| …::serves a dashboard sub-page route without an origin | `/settings` → 200/503 | S5 | no | low |
| functional/sidecar_trusted_connections.test.ts::accepts the desktop application's own development page | Origin `http://localhost:3125` → 101 | S6 bullet 2 + S4's shipped-front-end carve-out; the port is in the repo's `tauri.conf.json` | no under that carve-out — loopback allowlist or the dev page passes | medium |
| project/http.test.ts (23 cases: SPA routes, asset exclusion, index rewrite/theme) | existing helper behaviour | S6; file visible in the repo | no — module untouched; reference/alt_fix pass | low |
| project/connectors.test.ts (6 cases) | CLI launch/error normalisation | S6 | no | low |
| project/marketplace.test.ts (26 cases) | installer/catalog/desktop-command helpers | S6 | no | low |
| project/user-instructions.test.ts (1 case) | plugin package name | S6 | no | low |
| project/desktop-client.test.ts (3 cases) | webview transport failures | S6 | no | low |

## 2. Leniency (QUALITY)

| Property / trap | Most plausible WRONG fix | Caught? |
|---|---|---|
| L1 reported socket | gate only the `/browser` upgrade branch | yes — `dashboard_live_socket`, `dashboard_http_command`, `sidecar_transport` (`miss_live`, `miss_posts`, `miss_sidecar`); inverse `miss_base` |
| L1 refusal form | throw / abort instead of a client error | yes — every security row needs a 4xx (`crash.patch`) |
| L2 producer off the check path | use configured `PUBLIC_URL` verbatim, no port for a bare address | yes — `dashboard_public_address` bare-address rows (`miss_port.patch`) |
| L2 tunnel | always append the listening port | yes — tunnel row (`always_port.patch`) |
| L3 public delivery | require an Origin on every request | yes — `dashboard_public_pages` and the harness `/version` readiness probe (`overbroad.patch`, `refuse_all.patch`) |
| L4 second implementation | fix only the dashboard | yes — `sidecar_transport` (`miss_sidecar.patch`) |
| L4 scope | same-origin-only on the bridge | yes — `sidecar_trusted_connections` |
| S1 live socket | consult the public-path predicate before the upgrade flag | yes — `dashboard_live_socket` + shared-address live row (`miss_live.patch`) |
| S2 HTTP command | guard only upgrades / exempt unsafe methods | yes — `dashboard_http_command` + shared-address command row (`miss_posts.patch`) |
| Host property | check Origin only, or Host only | yes — the host rows and origin rows respectively |
| invite secret as authority | authorise on `roomSecret` alone | yes — `dashboard_shared_address` (`wrong_resource.patch`) |
| missing authority | fail open when no secret is configured | yes — default-env security rows (`missing_secret.patch`) |
| malformed identity | treat an unparseable Origin as trusted | yes — dashboard and bridge (`malformed.patch`) |

**Wrong fixes no test catches** (no check patch exists):
1. Origin-host == Host only: no matching foreign Host+Origin row.
2. Exempt all safe methods: no non-public GET row.
3. Sidecar any loopback scheme/port (`https://localhost:9999`): untested; the reference is permissive.
4. Configured host with any port/scheme (`http://100.82.5.118:9999`): untested.
5. Missing `Host`: untested (Bun may reject it first).
6. Guard after dispatch: rows read status/body only, and the command is read-only.

## 3. Hints (QUALITY)

- "being on the same machine is not enough" is redundant with S4's scheme/host/port rule; delete it.
- "must not bypass the check regardless of how the request arrives" names the mechanism; use "must be refused however the request arrives".
- "and its close variants" nudges toward enumeration; drop it.

## 3a. Required: generalize

1. "a connection that uses the deployment's configured public address must keep working in whatever form clients and the configuration present it." — names a configuration surface and the two address forms; it exists only for L2. Delete it: S6 plus S4 already require the configured host on the deployment's own listening port.

## 4. Realism (QUALITY)

L1–L3 are unmodified upstream code; L4 is a real, unmodified upstream bridge the published fix never touched (later hardened upstream) and is reachable through the real `/transport` upgrade; S1 (settings stream on a path the product's SPA predicate calls page content) and S2 (scripted HTTP fallback into the same dispatcher) are plausible maintainer siblings wired into the real listener. Nothing is planted; no flag.

## 5. Verdict

**READY.** All 24 security rows take any 4xx at any layer; all 12 functional rows assert the preserved 101/200. The primary mechanism — one origin/host gate over every acting request, exact scheme/host/port, the shipped-front-end carve-out, origin-free page delivery — passes both. The coupled values follow from S4 + S6 (the configured host on the deployment's own listening port; a tunnel's configured port), so no correct fix must see the tests. The project suites are the repository's visible tests and a correct fix leaves them untouched. No contradiction, hidden assertion, or layer-bypassing harness.

**Quality to tighten** (non-blocking):
- Add a matching foreign Host+Origin row (untested 1).
- Add sidecar wrong-port and wrong-scheme rows (untested 3) and one non-public safe-method GET row (untested 2).
- Add a public-address wrong-port/wrong-scheme row (untested 4).
- Assert no side effect with a mutating command (untested 6).
- Apply the hints and the 3a rewording.

Human review: confirm that the desktop development page (`http://localhost:3125`, a different port from the bridge's listener) is "a front end the product itself ships and serves"; the sidecar functional row depends on that reading, and applying S4's exact rule to it would fail.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
