# cline-s2 — pre-trial fairness review

Read: `tasks/cline-s2/instruction.md`, the two hidden suites (24 security, 12 functional) and the five restored project suites (59 cases), `solution/fix.patch`, `manifest.json`, `notes.md`, all 15 `checks/*.patch`. Nothing was run.

Covering sentences (`instruction.md`): **P1** "A local service must run or configure an agent session only for a request that comes from a page the deployment itself serves." **P2** "A request whose origin is not an address the deployment is configured to serve — including a request that presents no origin, an empty origin, or an unparseable origin — must be refused with a client error before any action, state change, or reply." **P3** "A request whose host does not name the deployment must likewise be refused." **P4** "Apart from a front end the product itself ships and serves, an address is one the deployment serves only when its scheme, host and port are the deployment's own; being on the same machine is not enough." **P5** "Serving the deployment's own pages and the public resources they load is not such an action; they must keep loading for a browser that sends no origin, exactly as they do today." **P6** "Everything that works today must keep working" + the preservation bullets. **P7** "The examples above are examples, not the full set: the property applies to every way a request can reach one of these services."

## 1. Test-by-test fairness

### Security suite (all unauthorised rows require only *some* 4xx, matching P2's "client error")

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| dashboard_socket::refuses an upgrade whose origin belongs to another site | `/browser` upgrade, foreign Origin → 4xx | P2 | no — dispatcher gate, `/browser` branch gate, or a separate validator all pass | low |
| dashboard_socket::… presents no origin | upgrade, no Origin → 4xx | P2 | no | low |
| dashboard_socket::… presents an empty origin | `Origin: ` → 4xx | P2 | no — `new URL("")`/empty handling suffices | low |
| dashboard_socket::… second foreign site | `https://attacker.example.net:8443` → 4xx | P2, P4 | no | low |
| dashboard_socket::… origin merely contains a trusted name | `http://localhost.evil.example` → 4xx | P4 (scheme/host/port are not the deployment's) | no — exact host compare, not suffix/prefix | low |
| dashboard_socket::… unparseable origin | `Origin: null` → 4xx | P2 | no | low |
| dashboard_socket::… right machine on another port | `http://127.0.0.1:9999` → 4xx | P4 ("being on the same machine is not enough") | no — the primary mechanism is exact address identity; additionally allowing the dashboard's *own* dev front end still refuses 9999 | medium |
| dashboard_socket::… another scheme | `https://127.0.0.1:<port>` → 4xx | P2, P4 | no | low |
| dashboard_socket::… host names another site | foreign Host, trusted Origin → 4xx | P3 | no — a fix may validate Host before or after Origin | low |
| dashboard_shared_address::invite holder, another site | valid secret + foreign Origin → 4xx | P1, P2 | no — a valid invite secret does not make another page deployment-served | low |
| dashboard_shared_address::invite holder, no origin | valid secret, no Origin → 4xx | P2 | no | low |
| dashboard_shared_address::invite holder, foreign host | public Origin + foreign Host → 4xx | P3 | no | low |
| dashboard_shared_address::live socket, foreign page | secret + foreign Origin on `/settings/live` → 4xx | P1, P7 | no — opening the socket is an action, not page delivery (P5) | low |
| dashboard_shared_address::command endpoint, foreign page | secret + foreign Origin POST → 4xx, no `"ok":true` | P1, P2, P7 | no | low |
| dashboard_live_socket::another site | `/settings/live` upgrade → 4xx | P1, P7 | no — P5 exempts loading pages/resources, not upgrades | low |
| dashboard_live_socket::no origin | upgrade no Origin → 4xx | P2, P7 | no | low |
| dashboard_http_command::another site | POST foreign Origin → 4xx, no `"ok":true` | P1, P2, P7 | no — unsafe verb is an action | low |
| dashboard_http_command::without origin | POST no Origin → 4xx | P2, P7 | no | low |
| sidecar_transport::another site | `/transport` upgrade foreign Origin → 4xx | P1, P7 (a local service) | no | low |
| sidecar_transport::without origin | upgrade no Origin → 4xx | P2, P7 | no | low |
| sidecar_transport::empty origin | `Origin: ` → 4xx | P2, P7 | no | low |
| sidecar_transport::second foreign site | `https://attacker.example.net:8443` → 4xx | P2, P4, P7 | no | low |
| sidecar_transport::origin merely contains a trusted name | `http://localhost.evil.example` → 4xx | P4, P7 | no | low |
| sidecar_transport::unparseable origin | `not a url` → 4xx | P2, P7 | no | low |

### Functional suite

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| dashboard_trusted_connections::dashboard page's own socket | same-origin `/browser` → 101 | P6 bullet 1 | no | low |
| dashboard_trusted_connections::settings live socket | same-origin `/settings/live` → 101 | P6 + P5 | no | low |
| dashboard_trusted_connections::command posted by the dashboard page | same-origin POST → 200 `"ok":true` | P6 | no | low |
| dashboard_public_address::shared address without a port | `PUBLIC_URL=http://100.82.5.118`, browser adds listening port → 101 | P6 bullet 3 ("omits the listening port") | no — the reference port-adoption producer, or accepting both portless and with-port forms, passes | low |
| dashboard_public_address::replayed commands through that address | same, POST + secret → 200 `"ok":true` | P6 | no — same producer | low |
| dashboard_public_address::tunnel hostname without a port | `PUBLIC_URL=https://tunnel.example`, portless Origin → 101 | P6 bullet 3 ("whatever form") | no — always-appending the port is the wrong fix and violates P6 | low |
| dashboard_public_pages::version | no-origin `/version` → 200 | P5, P6 | no — `/version` works today | low |
| dashboard_public_pages::config | no-origin `/config.json` → 200 | P5, P6 | no | low |
| dashboard_public_pages::health | no-origin `/health` → 200 | P5, P6 | no — "works today" covers it | low |
| dashboard_public_pages::dashboard page | no-origin `/` → 200/503 | P5 | no | low |
| dashboard_public_pages::sub-page | no-origin `/settings` → 200/503 | P5 | no | low |
| sidecar_trusted_connections::desktop dev page | `/transport` from `http://localhost:3125` → 101 | P6 bullet 2 + repo `tauri.conf.json` devUrl | no — the carve-out is explicit; the address is discoverable in the repository | medium |

### Project suite (restored pristine; counts inside the functional group)

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| project/http.test.ts::20 `isWebviewRoute` SPA-route cases + "does not treat nested marketplace asset requests as SPA routes" + "rewrites relative built asset URLs…" + "injects the persisted theme bootstrap once" (23) | pre-existing webview helpers | P6 / standard software engineering: existing tests keep passing | no — untouched module; reference/alt_fix/blind pass | low |
| project/connectors.test.ts::"uses Bun conditions…from Bun", "…compiled CLI subcommands…", "…from Node", "detects Windows Node…", "strips terminal color codes…", "turns Telegram unauthorized responses…" (6) | connector launcher/error normalisation | P6 | no — untouched | low |
| project/marketplace.test.ts::26 installer/catalog/desktop-command cases (MCP args, skills, plugins, redaction, catalog fetch) | installer behaviour | P6 | no — untouched | low |
| project/user-instructions.test.ts::"uses the package name for package-backed plugin entries" (1) | config listing | P6 | no — untouched | low |
| project/desktop-client.test.ts::"does not reject pending…", "rejects…transport failures", "only treats exact browser lifecycle messages…" (3) | webview client | P6 | no — untouched | low |

## 2. Leniency (QUALITY)

| Property / trap | Most plausible WRONG fix | Caught? (test + `checks/` patch) |
|---|---|---|
| L1 reported `/browser` socket | gate only the `/browser` upgrade branch | partly — `dashboard_live_socket` + `dashboard_http_command` + `sidecar_transport` (`miss_live`, `miss_posts`, `miss_sidecar`); `miss_base` covers the inverse (reported socket left open) |
| L1 refusal form | throw/abort instead of a client error | yes — every security row needs 4xx (`crash.patch`) |
| L2 producer off the check path | use configured `PUBLIC_URL` verbatim, no port for a bare address | yes — `dashboard_public_address` bare-address rows (`miss_port.patch`) |
| L2 adjacent API | always append the listening port | yes — tunnel row (`always_port.patch`) |
| L3 public delivery | require an Origin on every request | yes — `dashboard_public_pages` + harness readiness (`overbroad.patch`, `refuse_all.patch`) |
| L4 second implementation | fix only the dashboard listener | yes — `sidecar_transport` (`miss_sidecar.patch`) |
| L4 scope | same-origin-only on the bridge | yes — `sidecar_trusted_connections` dev-page row |
| S1 live socket | consult the public-path exemption before the upgrade flag; or exempt all GETs | yes — `dashboard_live_socket` (`miss_live.patch`) + shared-address live row |
| S2 HTTP command | guard only WebSocket upgrades / exempt unsafe methods | yes — `dashboard_http_command` (`miss_posts.patch`) + shared-address command row |
| invite secret as authority | authorise on `roomSecret` alone | yes — `dashboard_shared_address` (`wrong_resource.patch`) |
| malformed identity | treat an unparseable Origin as trusted | yes — dashboard and bridge (`malformed.patch`) |
| missing authority | fail open when no secret is configured | yes — default-env security rows (`missing_secret.patch`) |
| adjustment ordering | check a value after arithmetic/normalisation | n/a — no transform sits between attacker value and check; the public-address producer is coupled and tested |

**Wrong fixes no test catches.** (i) Same-host check: accept when `Origin`'s host/scheme equals the `Host` header, never checking Host against configured addresses — no test sends a *matching* foreign Host+Origin. (ii) Sidecar bridge that accepts any loopback scheme/port (`https://localhost:9999`) — only foreign/missing/empty/unparseable/lookalike are tested; the reference itself is permissive there. (iii) A guard placed *after* `handleDesktopCommand`/peer registration but before replying: the command test only reads and asserts status/body, not that state was untouched. (iv) A missing-`Host` request: no test omits Host. (v) A denylist of the single literal `evil.attacker.example` survives `dashboard_live_socket` and `dashboard_http_command` (each uses only that literal), though other suites use second/lookalike origins.

## 3. Hints (QUALITY)

- "including a request that presents no origin, an empty origin, or an unparseable origin" — variant list matching the test shapes. Neutral: "a request that does not present a usable origin naming an address the deployment is configured to serve".
- "even when that front end and the service bind different local ports" — names the L4 coupled variant. Neutral: "in whatever address form that front end presents".
- "including when the configuration omits the listening port" — names the L2 coupled variant. Neutral: drop the tail; "in whatever form clients and the configuration present it" already covers it.
- "the public resources they load" — echoes the public-route test set. Neutral: "the resources they load".
- P4's "being on the same machine is not enough" paraphrases the wrong-port trap, but it is a general address-identity rule (not route-specific) and removing it would make the 9999/another-scheme rows ambiguous. Retain for fairness.

## 3a. Required: generalize (NOT a gate-a reason)

The "In particular" bullets are a checklist that maps one-to-one onto traps L2/L4 and the trusted-connection tests. Replace all three bullets with one property: **"Everything that works today must keep working: connections from pages the deployment itself serves, and from front ends the product itself ships and serves, in whatever address form they present, and origin-free delivery of the deployment's own pages and the resources they load."** Also (i) replace the no/empty/unparseable origin enumeration with the general "no usable origin naming an address the deployment serves"; (ii) remove "even when that front end and the service bind different local ports"; (iii) remove "including when the configuration omits the listening port"; (iv) drop "public" before "resources".

## 4. Realism (QUALITY)

L1–L3 are unmodified upstream code at the pinned commit; L4 is real upstream code the published fix never touched (later hardened upstream), reachable through the real bridge entry point; S1 (live-settings stream reusing the peer registry, on a path the product's own SPA predicate classifies as page content) and S2 (REST command fallback calling the same dispatcher) are plausible maintainer additions wired into the real listener. None reads as planted. No realism flags.

## 5. Verdict

**READY.** All 24 security rows accept any 4xx; all 12 functional rows assert exactly the preserved 101/200. The primary stated mechanism (one origin/host gate above every route, with the P4 exact scheme/host/port rule and the P6 front-end carve-out) passes every row, and the manifest records reference, `alt_fix`, `hardening` and `blind` all at 1.0. A guard at the dispatcher, inside each handler, or at the option loader is equally acceptable; no row demands one error class or one layer. The one judgment is the scoping of the P6 "front end" carve-out for the two dev pages — it does not defeat a correct fix, but it should be confirmed.

**Quality to tighten** (non-blocking):
1. Add sidecar wrong-port and wrong-scheme cases so the bridge cannot pass by accepting any loopback origin (`https://localhost:9999`).
2. Add a matching foreign Host+Origin pair (`Host: evil.attacker.example`, `Origin: http://evil.attacker.example`) to catch the same-host check.
3. Assert no side effect before refusal with a mutating command (not only `get_global_settings`), and cover empty/unparseable/lookalike origins on `/settings/live` and `/api/desktop-command`.
4. Add a missing-`Host` case if Bun delivers it to product code; otherwise record why not.
5. Vary attacker-origin literals across the live and command suites.

Human review: confirm the scope of "a front end that the product itself ships and serves" — the dashboard's own Vite dev front end must not license arbitrary loopback ports (the `127.0.0.1:9999` row), while the desktop development page (`localhost:3125`) must remain accepted.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
