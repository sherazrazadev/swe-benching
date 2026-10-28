# Build one security-fix benchmark task (build-v1)

## What this is
We build a security-fix benchmark from published, already-fixed advisories in open-source projects.
You build ONE task, from the advisory below.

The task pins the project at the commit just before the published fix and gives a solver agent that
code plus a short problem report (`instruction.md`). Hidden behavioural tests then score the
solver's fix. The tests check that the flaw is closed, using harmless inputs and markers, and that
legitimate use still works.

Everything stays on this machine. Describe each mechanism in one line in notes and reports; the
tests hold the detail, so never write exploitation steps out in prose. Stay inside this advisory's
own protection, in this repository, at the pinned commit. Note anything outside that scope in one
line in your report, and do not build on it.

Project root: `/home/mara/cwe-bench`. Task: `9router-s4`. Pattern: `A+B`. Track: `injected`.

## Goal and acceptance
- **The bar.** Two target models (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) must each fail all 3
  finished attempts because of their own judgement.
- **Fairness.** Everything the tests require must be findable from `instruction.md` plus the code,
  or be standard expert knowledge. A careful engineer who knows where to look fixes it in about
  45 minutes.
- **What never counts as a failure:** timeouts, and runs cut by API or network errors.
- **Proof.** A task is built only when the gate passes. A task that misses the bar is reported as
  such, never shipped weaker.

## Inputs
- Advisory: ["GHSA-6G2F-W7G3-77VF", "CVE-2026-49353"]; decolua/9router; access-control bypass by spoofed identity (CWE-290 authentication bypass by spoofing, CWE-807 reliance on untrusted inputs in a security decision, CWE-306 missing authentication for critical function); specifically an incomplete fix of the earlier loopback-only gate
- Pinned (vulnerable) commit: 6493391415776144ebb923d86e7afc91f705042d. Published fix: 5e1c1261368e06dced1cbc650684561b2c8844db, bb86808582067e4fc6f004508a919efb9970d1d5.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash",
 "entry_id": "9108",
 "advisory_ids": [
  "GHSA-6G2F-W7G3-77VF",
  "CVE-2026-49353"
 ],
 "repo": "decolua/9router",
 "pinned_commit": "6493391415776144ebb923d86e7afc91f705042d",
 "fix_commits": [
  "5e1c1261368e06dced1cbc650684561b2c8844db",
  "bb86808582067e4fc6f004508a919efb9970d1d5"
 ],
 "trust_decision": {
  "summary": "Whether a request may reach a spawn-capable / host-secret route, or any /api/* route at all, is decided by the Next.js proxy: first by config.matcher (which decides whether dashboardGuard.proxy runs) and then by isLocalRequest, which trusts the attacker-controlled Host header (and Origin only when the client chooses to send it) instead of a secret.",
  "evidence": [
   "src/proxy.js:4-17",
   "src/dashboardGuard.js:56-57",
   "src/dashboardGuard.js:58-63",
   "src/dashboardGuard.js:92-96",
   "src/dashboardGuard.js:105-111",
   "next.config.mjs:54-61"
  ]
 },
 "landing_point": {
  "where": "src/dashboardGuard.js:56-65",
  "why": "The advisory summary names a local-only gate bypassed by Host header spoofing, so the first grep lands on isLocalRequest and the LOCAL_ONLY_PATHS gate that calls it at src/dashboardGuard.js:92-96; the matcher that decides whether that code runs at all lives in a different file."
 },
 "fix_sites": [
  {
   "where": "src/proxy.js:4-17",
   "entry_point": "every HTTP request routed through the Next.js proxy (matcher widened to all paths except _next static assets, fix.diff:425-448)",
   "module_kind": "wrapper_or_composition (the re-export file also owns the matcher)"
  },
  {
   "where": "src/dashboardGuard.js:105-111",
   "entry_point": "every /api/* route (allow-list replaced by deny-by-default + PUBLIC_API_PATHS, fix.diff:411-416)",
   "module_kind": "middleware auth gate"
  },
  {
   "where": "src/dashboardGuard.js:40-44",
   "entry_point": "POST /api/mcp/[plugin]/message, GET /api/mcp/[plugin]/sse, POST /api/tunnel/tailscale-install, POST /api/cli-tools/cowork-settings, GET /api/oauth/cursor/auto-import, GET /api/oauth/kiro/auto-import (LOCAL_ONLY_PATHS extended)",
   "module_kind": "middleware local-only gate"
  },
  {
   "where": "src/dashboardGuard.js:92-96",
   "entry_point": "same local-only routes; gate changed from isLocalRequest to canAccessLocalOnlyRoute = valid CLI token (fix.diff:86-94)",
   "module_kind": "middleware local-only gate"
  },
  {
   "where": "src/dashboardGuard.js:22-25",
   "entry_point": "POST /api/version/update, POST /api/version/shutdown, POST /api/oauth/cursor/auto-import, POST /api/oauth/kiro/auto-import, POST /api/shutdown, POST /api/settings/database (ALWAYS_PROTECTED extended)",
   "module_kind": "middleware auth gate"
  },
  {
   "where": "fix.diff:38-62",
   "entry_point": "remote /v1, /v1beta, /api/v1, /api/v1beta LLM API calls (isPublicLlmApi + canAccessPublicLlmApi + extractApiKey/hasValidApiKey added)",
   "module_kind": "middleware auth gate (new branch at fix.diff:100-103)"
  },
  {
   "where": "src/app/api/tunnel/tailscale-install/route.js:37-58",
   "entry_point": "POST /api/tunnel/tailscale-install SSE stream (controller closed/errored guard, fix.diff:290-312)",
   "module_kind": "route handler robustness, not access control"
  }
 ],
 "O1_entry_points": 8,
 "O2_out_of_scope_site": {
  "kind": "wrapper_or_composition",
  "where": "src/proxy.js:1-18"
 },
 "O3_reason_to_dismiss": "src/proxy.js is a one-line re-export of dashboardGuard.proxy, so an engineer who fixes the Host-header check inside dashboardGuard.js reads the second file as plumbing and never widens config.matcher, leaving /api/version/*, /api/oauth/* and /api/v1* outside the guard entirely.",
 "O4_distance": {
  "files": 4,
  "packages": 2,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Unauthenticated loopback traffic must keep reaching both the LLM API and the pre-login reads: /v1 and /v1beta are used by local CLI tools with no dashboard session, and the login page reads requireLogin before any credential exists, so a fix that makes the loopback allowance token-only everywhere (or deny-by-default without an allow-list) breaks local tools and the login page.",
  "where": "src/dashboardGuard.js:56-65, src/dashboardGuard.js:107, src/app/api/settings/require-login/route.js:4-11, src/app/api/v1/models/route.js:1-9"
 },
 "O6_input_shapes": [
  "Pathname spelling for the same handler: /v1 and /v1beta rewritten to /api/v1 by next.config.mjs:54-61, versus /api/v1 and /api/v1beta called directly; matching is p === pathname || pathname.startsWith(p + '/'), so /v1/v1 (next.config.mjs:43-49) and /api/v1beta also count",
  "Host header shapes: 'localhost:20128' (port split off at src/dashboardGuard.js:50), '[::1]' (brackets stripped at src/dashboardGuard.js:50), '127.0.0.1', and any spoofed non-loopback spelling that defeats the gate",
  "Origin present vs absent: an omitted Origin is accepted (src/dashboardGuard.js:58-63), so a non-browser client needs no Origin at all; a cross-site browser form post does send one",
  "Credential shapes for the remote LLM API: 'Authorization: Bearer <key>' and 'x-api-key: <key>', Bearer taking precedence (fix.diff:42-46)",
  "Method shapes for the same route family: GET (auto-import, mcp sse) and POST (mcp message, tailscale-install, version/update, version/shutdown)"
 ],
 "O7_producer": {
  "kind": "mapper",
  "where": "src/shared/utils/machineId.js:10-19 derives the CLI token as sha256(machineId + '9r-cli-auth')[0:16], cached per process at src/dashboardGuard.js:9-13 and re-derived in two other places: src/app/api/cli-tools/cowork-settings/route.js:18-22 (injects the header into generated MCP configs) and cli/src/cli/api/client.js:17-28 (the CLI's own copy)",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [
  {
   "route": "POST /api/auth/login decides 'is this request coming in over the tunnel?' from the Host header, so a tunneled client that sends Host: localhost logs in even when settings.tunnelDashboardAccess is false \u2014 the same spoofable-locality decision the advisory is about, in another file, untouched by the fix",
   "where": "src/app/api/auth/login/route.js:8-13",
   "reason_to_dismiss": "Login is the public auth endpoint that has to be reachable from anywhere, and the tunnel-dashboard restriction reads as a separate dashboard policy rather than the spawn-capable local-only gate the advisory names.",
   "distance": "one directory tree away (src/app/api/auth vs src/), 1 file from the landing point",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "The /dashboard tunnel block also compares the Host header against settings.tunnelUrl/tailscaleUrl, so a spoofed Host skips the 'dashboard access via tunnel is disabled' redirect; the fix leaves this branch exactly as it was",
   "where": "src/dashboardGuard.js:125-131",
   "reason_to_dismiss": "It is a redirect policy for dashboard pages, not an access gate, and the route still falls through to the JWT check three lines later, so a solver reads the Host comparison as a UX affordance.",
   "distance": "same file, ~35 lines from the local-only gate",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "POST /api/tunnel/tailscale-start-daemon (and its siblings /api/tunnel/tailscale-login, /api/tunnel/tailscale-enable, /api/tunnel/enable, /api/tunnel/disable) spawn host processes - tailscaled with a request-supplied sudo password, or cloudflared - yet are only session-auth-gated and never added to LOCAL_ONLY_PATHS, while the fix's own comment calls LOCAL_ONLY_PATHS the list for routes that spawn processes or read host secrets",
   "where": "src/app/api/tunnel/tailscale-start-daemon/route.js:10-16",
   "reason_to_dismiss": "They sit behind dashboard/CLI auth already, and the tunnel feature has to be operable from a dashboard that may itself be reached over a tunnel, so loopback-only looks like it would break the feature.",
   "distance": "src/app/api/tunnel/ vs src/dashboardGuard.js \u2014 2 directories, and the spawn is two layers deeper in src/lib/tunnel/tailscale.js:5,525",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "src/app/api/oauth/kiro/import/route.js:9-11",
   "sibling": "A third 'auto-import from another IDE's local credential store' route (Windsurf / VS Code Copilot) beside the cursor and kiro pairs",
   "why_realistic": "The tree already ships cursor/import + cursor/auto-import and kiro/import + kiro/auto-import as two parallel families, so a maintainer adding one more IDE copies auto-import and forgets that only the auto-import half reads host files and needs LOCAL_ONLY_PATHS."
  },
  {
   "where": "src/app/api/cli-tools/cowork-settings/route.js:24-30",
   "sibling": "A second config-writer that embeds the x-9r-cli-token header into generated client configs",
   "why_realistic": "This file already re-derives the CLI token and injects it for localhost /api/mcp/ entries; every new local-only route that a generated client must reach needs the same injection, and a maintainer writing another writer would copy these ~5 lines and the cached token value."
  },
  {
   "where": "src/app/api/version/update/route.js:4-21",
   "sibling": "A process-spawning host-maintenance route (restart, repair, log-collect, install-binary) that is auth-gated but not local-only",
   "why_realistic": "version/update and version/shutdown already call killAppProcesses/spawnUpdaterAndExit next to tailscale-install doing the same for tailscaled, so 'add another maintenance action' lands in the same shape and the local-only question repeats."
  }
 ],
 "O9_family": "access-control bypass by spoofed identity (CWE-290 authentication bypass by spoofing, CWE-807 reliance on untrusted inputs in a security decision, CWE-306 missing authentication for critical function); specifically an incomplete fix of the earlier loopback-only gate",
 "O9_dos": false,
 "O10_build": {
  "language": "JavaScript (ESM; Next.js 16 App Router, React 19, Node runtime routes)",
  "toolchain": "npm (package.json:7-13: next build --webpack, next start on port 20128); bun variants present; tests use vitest 4 (tests/package.json:8) with the @/ and open-sse aliases in tests/vitest.config.js:15-22",
  "services": [],
  "offline_after_build": true,
  "project_tests": "28 vitest unit files under tests/unit at the pinned commit (e.g. tests/unit/oauth-cursor-auto-import.test.js); none exercise src/dashboardGuard.js or src/proxy.js, and the fix adds tests/unit/dashboard-guard.test.js as a new file"
 },
 "O11_fix_minutes": 30,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "A+B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/dashboardGuard.js, src/proxy.js, src/app/api/tunnel/tailscale-install/route.js",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Tighten the locality test itself - reject non-loopback Host more strictly, parse X-Forwarded-For, or accept the socket address - which is still header/proxy-derived, and leave config.matcher in src/proxy.js plus the two duplicated Host comparisons untouched."
 },
 "out_of_scope_notes": [
  "src/app/api/auth/login/route.js:25-38: password login falls back to the default '123456' (or INITIAL_PASSWORD) when no hash is stored - a credential-policy issue, not this advisory.",
  "src/dashboardGuard.js:81-86: requireLogin === false makes isAuthenticated() true for every PROTECTED path, which is a documented setting rather than the local gate.",
  "src/app/api/tunnel/tailscale-install/route.js:25,44: a request-supplied sudo password is handed to installTailscale - host command execution, but the advisory's property only covers who may reach it."
 ],
 "unverified": [
  "Repo size in MB: no shell was available this session, so tiny_repo (<5 MB) and giant_repo (>1.5 GB) were not assessed and left unflagged; the tree includes a gitbook docs subapp, 126 route files and monaco, so it is unlikely to be under 5 MB of source.",
  "The advisory body itself was not provided (only the one-line summary plus GHSA/CVE ids), so the published advisory's exact affected versions and wording were inferred from the fix diff.",
  "present_in_latest for all three O8 routes: only the pinned tree and the fix diff exist here, with 'latest release: none' and no network; the fix diff does not touch src/app/api/auth/login/route.js or the tunnel management routes, so the published fix leaves them unchanged.",
  "O1 counted by route family (auto-import cursor, auto-import kiro, version/update, version/shutdown, MCP bridge, tailscale-install, cowork-settings, remote /v1+/api/v1), not per individual route file.",
  "Whether the /codex/* rewrite (next.config.mjs:51-53) should also be in the public LLM allow-list after the fix - outside this advisory's local-only property, not checked.",
  "needs_network_at_runtime not flagged: the guard decisions themselves are offline, but exercising /api/tunnel/* or /api/oauth/*/auto-import needs host binaries (tailscale, sqlite3) that were not checked for."
 ]
}
  ```
- Published fix sites:   - src/proxy.js:4-17 — entry point: every HTTP request routed through the Next.js proxy (matcher widened to all paths except _next static assets, fix.diff:425-448) [wrapper_or_composition (the re-export file also owns the matcher)]
  - src/dashboardGuard.js:105-111 — entry point: every /api/* route (allow-list replaced by deny-by-default + PUBLIC_API_PATHS, fix.diff:411-416) [middleware auth gate]
  - src/dashboardGuard.js:40-44 — entry point: POST /api/mcp/[plugin]/message, GET /api/mcp/[plugin]/sse, POST /api/tunnel/tailscale-install, POST /api/cli-tools/cowork-settings, GET /api/oauth/cursor/auto-import, GET /api/oauth/kiro/auto-import (LOCAL_ONLY_PATHS extended) [middleware local-only gate]
  - src/dashboardGuard.js:92-96 — entry point: same local-only routes; gate changed from isLocalRequest to canAccessLocalOnlyRoute = valid CLI token (fix.diff:86-94) [middleware local-only gate]
  - src/dashboardGuard.js:22-25 — entry point: POST /api/version/update, POST /api/version/shutdown, POST /api/oauth/cursor/auto-import, POST /api/oauth/kiro/auto-import, POST /api/shutdown, POST /api/settings/database (ALWAYS_PROTECTED extended) [middleware auth gate]
  - fix.diff:38-62 — entry point: remote /v1, /v1beta, /api/v1, /api/v1beta LLM API calls (isPublicLlmApi + canAccessPublicLlmApi + extractApiKey/hasValidApiKey added) [middleware auth gate (new branch at fix.diff:100-103)]
  - src/app/api/tunnel/tailscale-install/route.js:37-58 — entry point: POST /api/tunnel/tailscale-install SSE stream (controller closed/errored guard, fix.diff:290-312) [route handler robustness, not access control]
- Uncovered routes to confirm (pattern B):   - src/app/api/auth/login/route.js:8-13 — POST /api/auth/login decides 'is this request coming in over the tunnel?' from the Host header, so a tunneled client that sends Host: localhost logs in even when settings.tunnelDashboardAccess is false — the same spoofable-locality decision the advisory is about, in another file, untouched by the fix (reason to dismiss: Login is the public auth endpoint that has to be reachable from anywhere, and the tunnel-dashboard restriction reads as a separate dashboard policy rather than the spawn-capable local-only gate the advisory names.; still in latest: unknown)
  - src/dashboardGuard.js:125-131 — The /dashboard tunnel block also compares the Host header against settings.tunnelUrl/tailscaleUrl, so a spoofed Host skips the 'dashboard access via tunnel is disabled' redirect; the fix leaves this branch exactly as it was (reason to dismiss: It is a redirect policy for dashboard pages, not an access gate, and the route still falls through to the JWT check three lines later, so a solver reads the Host comparison as a UX affordance.; still in latest: unknown)
  - src/app/api/tunnel/tailscale-start-daemon/route.js:10-16 — POST /api/tunnel/tailscale-start-daemon (and its siblings /api/tunnel/tailscale-login, /api/tunnel/tailscale-enable, /api/tunnel/enable, /api/tunnel/disable) spawn host processes - tailscaled with a request-supplied sudo password, or cloudflared - yet are only session-auth-gated and never added to LOCAL_ONLY_PATHS, while the fix's own comment calls LOCAL_ONLY_PATHS the list for routes that spawn processes or read host secrets (reason to dismiss: They sit behind dashboard/CLI auth already, and the tunnel feature has to be operable from a dashboard that may itself be reached over a tunnel, so loopback-only looks like it would break the feature.; still in latest: unknown)
- Design plan from the lead: No lead plan is provided for this task — you are the lead as well as the builder. Using the Design section above and the screener record, design the task yourself and WRITE YOUR PLAN in `notes.md` BEFORE you build:
  - choose the main lever and at least one more, each with a DIFFERENT reason a solver would dismiss or skip it. The main lever must be HOW-type (its fix needs the mechanism understood: a producer the check never calls, a coupled must-keep-working value, a shape a plausible check mishandles, a route where the protection never existed); another entry point or a planted copy is only an extra;
  - decide the sites, routes and input shapes the security tests will cover;
  - identify the coupled must-keep-working behaviour next to each lever, for the functional tests;
  - for the injected track: decide the realistic sibling gap(s) to add — each must be code a maintainer could plausibly have left, reachable through the real entry point, covered by the task's one general property (never by a sentence of its own), and placed where the published fix never touches. First list EVERY possible sibling site and route you can find (the screener's O8/O8b leads plus your own search of the code). Then pick 2–4 of them: the most complex and hardest to find of all the candidates (how-type over where-type, far from where the report leads, with a plausible reason to dismiss), each with a different reason a solver would skip it. Record the full candidate list, and why each pick beat the others, in notes.md;
  - write the security property ONCE, in general terms over the protected data or outcome, before choosing routes. Every route and sibling must fall under it as written; the report must not describe where any of them lives;
  - if this candidate cannot support a fair task that meets the bar (flaw does not reproduce at the pinned commit through a real entry point, needs network/GPU/GUI at run time, or no design meets the bar), STOP and report why. Do not ship a weak task.
Follow every rule in the Design, Report, Tests and Proof sections exactly. You choose the design; the rules are fixed.
- Host notes: none

## Design: where difficulty comes from
Models find the code the report leads to and diagnose it correctly. They fail on scope. Build these
in, in order of evidence:
1. **Pattern A: the published fix's far sites.**
   - The report leads to one site. The tests cover every entry point the published fix protects,
     including one in a module that looks out of scope: a second implementation, a lower-level
     public API, a wrapper, a save/reload path, or a defaults or merge route.
   - Give it a plausible **reason to dismiss**, and **distance**: another file or package from the
     landing point.
   - **A second implementation is the strongest form of this**: separate code doing the same
     guarded operation (a fallback backend, another package, another transport, a legacy version),
     so fixing the reported copy changes nothing in the other. Models fix the copy the example hits,
     re-run the example and stop. Prefer a real one (Pattern A or B) over a planted one. Find
     candidates by searching for the low-level primitive across packages (redirect following,
     header copying, file writes, message construction). It only counts if the report never
     describes it.
2. **Pattern B: uncovered routes.**
   - Routes into the same protected sink where the advisory's own protection is missing at the
     pinned commit, and which the published fix did not touch.
   - They are unmodified upstream code. A solver may argue they were never covered, but the task's
     general property covers them, so leaving one open is a model failure, not out of scope. The
     same holds for a route where the protection never existed: the property requires it.
   - Make sure the property, read literally, really covers each route (no word that excludes it),
     and that its test fails only when the protection is really missing (it must pass a correct
     fix placed at any valid layer).
   - The strongest lever found so far: DeepSeek 6 of 6 on one; both models 0 of 3 on three combined.
3. **Shape traps: an input form that a plausible check mishandles.** Examples: a value given as an
   array where the check only handles a string; a name split on the first separator when it can
   contain the separator; a resolved path against a lexical check; a rename or rewrite that happens
   after the check; a nested expression the check never inspects. Two conditions: the general
   property must cover the form literally, and the form must not fall inside anything a
   must-keep-working clause or a test fixture calls legitimate. A pure spelling, encoding, verb,
   protocol or role variant of a stated input is NOT a shape trap: both models always catch those
   (see "Never add").
4. **A coupled must-keep-working behaviour** next to the sink, tested functionally, so an
   over-broad fix fails. MiMo tends to over-harden.
5. **Producer off the check's path.** The check depends on data produced elsewhere (a schema,
   serializer, cache, mapper, table builder or config loader) and does not call it; the data
   reaches the check on a separate path (saved and reloaded, rebuilt from config). The fix needs
   both the check and the producer. Models trace into what the check calls, never back to where
   its data comes from. Rules:
   - it counts only if the producer is infrastructure, not a request handler;
   - verify that the check does **not** call the producer; if it does, the model follows the call
     and fixes it;
   - the report describes impact only through the check's path and states the property abstractly
     ("including data saved earlier"); it never points at the producer or the reload path;
   - avoid fixes where the check cannot compile without the producer change (that forces the find);
   - hidden tests must not need a field or function name the solver would have to guess;
   - prefer a producer deep in internal machinery (a table or schema builder). One behind a path
     that is easy to follow falls as soon as anything points at it.
6. **Injected siblings**, only where the plan asks for them. Each must be:
   - code a maintainer could have written, with no deceptive names or comments;
   - reachable through the real entry point;
   - covered by the task's general property, never by a sentence of its own;
   - placed where the upstream fix never touches.
7. **Wrong object.** The authorization check exists but decides on a different object than the one
   the request actually touches: a neighbouring or proxy resource (a parent or container instead of
   the item written), or an identity field the caller supplies (an account inside a caller-provided
   resource name; a parent read from one part of the request while the write uses another). Models
   copy the nearby precedent. Rules:
   - the instruction names the protected object class in product terms ("the objects that hold the
     limits"), never the check or its location;
   - the security test denies exactly the object touched while the proxy object stays allowed;
   - a functional test keeps a legitimate request on that same object working.
8. **Ordering.** The check is right but runs at the wrong moment: after an adjustment turns the
   attacker's value into a different bad value (an offset, a clamp, a unit conversion, a
   normalisation), or after a side effect has already happened (a directory created, a file cleared,
   copied or re-permissioned, a request sent) before the refusal. Rules:
   - the instruction states the property over the attacker's input or the outcome ("nothing outside
     the folder is created or changed, even when the request is refused"), never the order of steps;
   - the security test checks the side effect itself, not only the response;
   - any fix that keeps the property passes, wherever it places the check.
9. **Route where the protection never existed.** Real code reaches the protected sink but never had
   the check at all, so its absence reads as design (DeepSeek missed one 6 of 6 times). Rules:
   - it needs a plausible reason to dismiss: an unsupported combination, a legacy path, a
     neighbouring feature. If the project documents the protection as applying everywhere with no
     exceptions, there is no reason to dismiss and the route adds nothing;
   - the general property must cover it literally; never describe it in the instruction;
   - confirm it with a behavioural test on the pinned copy, like any Pattern B route.
10. **Merged or defaults route.** The restricted value reaches the sink through defaults, a merge,
    inheritance, a patch, or stored configuration rather than the request field the report shows.
    Models treat the report's example fields as the whole set. Rules:
    - state the property over the sink ("anything a submitter supplies that ends up in X, however
      it gets there"), not over the entry or field;
    - the security test drives the merged or stored route through the real entry point;
    - a functional test keeps legitimate defaults and merges working.

Aim for at least two levers with **different** reasons to dismiss.

**At least one lever must be how-type**: its fix needs the mechanism understood, not only found.
How-type levers are a producer off the check's path (5), a coupled must-keep-working value (4), a
shape that a plausible check mishandles (3: a separator split, a rename after the check), and a
route where the protection never existed. Where-type levers (another entry point into the same code,
a second copy, injected siblings) only cost a search. They held only when the report stayed general,
so count them as extras, never as the task's main difficulty.

Never add:
- encoding, verb, protocol or role/direction variants;
- more routes of one concept;
- resource-exhaustion traps.

Every lever must be findable by a blind engineer from the report and the code. A lever that a blind
fix cannot find is unfair: remove it.

**Pattern B rules:**
- Confirm each route with a behavioural test on the pinned copy before relying on it. The
  screener's claim is only a lead.
- Append one row per route to `/home/mara/cwe-bench/build/audit/uncovered-routes.tsv`, using its existing
  header. Columns:
  - `task`, `repo`, `advisory`;
  - `trap_ref` (the manifest trap id only; no mechanism text, since the manifest holds the detail);
  - `real_upstream`;
  - `present_in_latest` (`yes`, `no` or `unknown`, from a read-only look at current upstream code if
    you can reach it);
  - `public_upstream_report`, `in_current_scope`, `built`, `note`;
  - `disclosure_status` (`pending client decision`).

## Environment (`tasks/9router-s4/environment/Dockerfile`)
- **Base and code.** A small official base image. The repo goes into `/app` at the pinned commit,
  and `/app/.git` is then deleted.
- **Offline.** Install every dependency, tool and service the project and tests need; nothing may
  be downloaded at test time. Services start from `test.sh`.
- **Packages:** `patch`, `curl`, `ca-certificates`, `bash`, `git`.
- **Agent layer.** Append `common/trial/claude-code.Dockerfile.snippet` unchanged at the end.
- **No test code in the image.** The agent shares the container. Pre-build against stubs; `test.sh`
  copies the real tests in at grading time.
- **Project tests.** The project's own tests for the affected area must pass in the image at the
  pinned commit.
- **No leaked regression tests.** The pinned commit must not already contain the advisory's
  regression tests (check `git log` between the pinned and fix commits).

## Report to the solver (`tasks/9router-s4/instruction.md`)
**Write:**
- what the system is, at product level;
- one observed impact, with ONE concrete trigger at user level (HTTP request, CLI call or public API
  use);
- the security property as an **invariant**, stated once in general terms: who may do what to which
  data, or what attacker input must never achieve ("no value of X may …, however it arrives"). It is
  fair when, read literally, it covers every tested route and shape; it must not point at any of
  them. Write a second property only for a genuinely different protection, never one per route,
  and never a count;
- every **contract** the tests need, each stated once for the whole product, never per route:
  - the refusal form ("a client error with no side effect");
  - any interface or field name a test uses, stated so it applies everywhere. If a sibling's test
    would need a contract that only that sibling uses, change the test so it does not, or drop the
    sibling;
  - preservation clauses ("everything that works today keeps working exactly as today"). Name a
    coupled legitimate value in property terms ("visible values keep binding even next to a hidden
    one"), not by the feature or route it sits on;
  - a legitimate magnitude next to any attack magnitude;
- that examples are examples, not the full set;
- the standard constraints block: fix the problem and its close variants; keep legitimate use
  working; do not look up the upstream fix; do not special-case the
  example.

**Never write:**
- file, package, function, class, field or parameter names a user would not see;
- line numbers, the root cause, the fix approach, or a CVE or GHSA id;
- a list of routes, spellings or roles;
- restricting adverbs ("directly", "only via");
- anything that names or paraphrases a far site, an uncovered route or an injected sibling;
- any clause that describes where a far site, uncovered route or injected sibling lives, even in
  product terms: no route, operation, command, channel, object kind, stage or format that points
  at one of them. State each property once, over the protected data or outcome, so it covers every
  route without pointing at any;
- a word that is general but is also the name of one stage or entry point ("loading" when the
  product has a load call). Pick wording that cannot be read as one surface.

Check before you finish: for each sentence of the report, ask whether it exists to cover one
specific route or trap. If it does, delete it or widen it into the general property.

Put every identifier that must not appear in `manifest.leak_terms`.

## Tests (`tasks/9router-s4/tests/`)
- **`security/`:** one test per site, route, input shape and form. Each one:
  - goes through the real entry point;
  - fails on the pinned code and passes on a correct fix;
  - asserts the attack is blocked: any client error plus no side effect, never one exact status.
- **`functional/`:**
  - legitimate use, including the coupled behaviour of every lever;
  - where they exist, the project's own tests for the area.
- **No product code in a test's bookkeeping.** Compute expected values and clean-ups in the test
  itself, because a hardened helper must not crash a test.
- **Stubs** of permission or authority answer per resource and verb, like the real thing.
- **Scope.** A test may vary only what the instruction names, and drive only the entry point it
  names.
- **No network**, and nothing that depends on the fix commit being present.
- **Templates.** JUnit XML into the two directories the template names. Copy `score.py` unchanged.
  Edit only the marked command lines of `test.sh`, and keep its agent-kill block.

## Proof
- **The oracle.** `solution/fix.patch` is the published fix reduced to source changes, plus fixes
  for every uncovered route and injected sibling in the task. `solution/solve.sh` applies it to
  `/app`.
- **Wrong-fix patches** go in `build/9router-s4/checks/`, listed in `manifest.patch_checks`:
  - one `security_fail` per lever (the fix that misses only that lever);
  - a `functional_fail` (an over-broad or feature-removing fix);
  - a `pass` of kind `hardening` (the oracle plus defensive hardening of the product code the
    security tests import);
  - a `pass` alternative fix where a second valid design is plausible.
- **`manifest.wrong_fix_catalogue`:** for each class, a `checks/` patch, or `n/a: <why>`:
  `refuse_all`, `crash_as_refusal`, `wrong_resource`, `one_role_or_direction`, `reads_only`,
  `check_after_adjustment`, `unlisted_route`, `malformed_identity`, `missing_authority`,
  `adjacent_api`.

## Deliverables
**`tasks/9router-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/9router-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `A+B`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/9router-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py 9router-s4 --only static
python3 -I common/gate/gate.py 9router-s4 --only nop
python3 -I common/gate/gate.py 9router-s4 --only oracle
python3 -I common/gate/gate.py 9router-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/9router-s4/`;
  - edit only `tasks/9router-s4/`, `build/9router-s4/` and, for pattern B, the register;
  - do not commit.

## Stop and report instead of shipping when
- the flaw does not reproduce through a real entry point at the pinned commit;
- a planned route or site is not reachable, or the check calls the producer directly (substitute
  another lever the code supports if you can, and say so);
- the task needs network at run time, or a GPU, kernel or GUI;
- the tests are flaky;
- no design meets the bar.

## Report back (under 400 words)
- The gate result for each stage.
- Each lever in one line: pattern, shape, file:line, reason to dismiss.
- Pattern B: each register row.
- The instruction's word count.
- Every guess you could not verify.
- Any fairness concern you see yourself.
- Anything noticed outside the scope, in one line.
- If abandoned, exactly why.
