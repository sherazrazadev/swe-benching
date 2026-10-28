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

Project root: `/home/mara/cwe-bench`. Task: `identrail-s4`. Pattern: `A`. Track: `injected`.

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
- Advisory: ["GHSA-CP3J-M783-3PH5", "CVE-2026-59185", "GO-2026-6448"]; identrail/identrail; CWE-639 cross-tenant IDOR / CWE-862 missing authorization on GitHub App installation binding
- Pinned (vulnerable) commit: e788c1986e52507f8d576ee51446a30a266e723d. Published fix: 835e40517509d6ef5405c27fbf14f579bedff0e7.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "17186",
 "advisory_ids": [
  "GHSA-CP3J-M783-3PH5",
  "CVE-2026-59185",
  "GO-2026-6448"
 ],
 "repo": "identrail/identrail",
 "pinned_commit": "e788c1986e52507f8d576ee51446a30a266e723d",
 "fix_commits": [
  "835e40517509d6ef5405c27fbf14f579bedff0e7"
 ],
 "trust_decision": {
  "summary": "Both GitHub App connect-completion handlers bind a client-supplied installation_id to the caller's project after matching only a pending-connector state value, so nothing ever decides whether the caller's GitHub identity owns that installation.",
  "evidence": [
   "internal/api/github_connect.go:449-451",
   "internal/api/github_connect.go:490",
   "internal/api/github_connect.go:519-520",
   "internal/api/github_connect.go:794-796",
   "internal/api/github_connect.go:818-821",
   "internal/api/github_connect.go:840",
   "internal/api/router.go:2225-2232",
   "internal/api/router.go:3654-3661"
  ]
 },
 "landing_point": {
  "where": "internal/api/github_connect.go:447",
  "why": "The advisory summary and the product docs name the connector completion call (docs/auth/github-connector.md:30-32, route registered at internal/api/router.go:2211), so the first read is CompleteGitHubConnector and its request struct at internal/api/github_connect.go:113-119."
 },
 "fix_sites": [
  {
   "where": "internal/api/github_connect.go:447-545",
   "entry_point": "POST /v1/connectors/github/complete",
   "module_kind": "http_handler (internal/api), connector completion service method"
  },
  {
   "where": "internal/api/github_connect.go:781-858",
   "entry_point": "POST /v1/workspaces/{workspace_id}/projects/{project_id}/github/connect/complete",
   "module_kind": "http_handler (internal/api), second (legacy project-scoped) implementation of the same completion"
  },
  {
   "where": "internal/api/router.go:2225-2232",
   "entry_point": "POST /v1/connectors/github/complete (header fallback path)",
   "module_kind": "http_router: X-GitHub-Installation-ID string fallback removed"
  },
  {
   "where": "internal/api/router.go:3654-3661",
   "entry_point": "POST /v1/workspaces/{workspace_id}/projects/{project_id}/github/connect/complete (header fallback path)",
   "module_kind": "http_router: X-GitHub-Installation-ID string fallback removed"
  },
  {
   "where": "fix.diff:1344",
   "entry_point": "UserOAuthClient.VerifyInstallationOwnership (new public connector API, internal/connectors/github/oauth.go)",
   "module_kind": "connector_client / lower_level_api, new package file absent at pinned commit"
  },
  {
   "where": "internal/api/service.go:225-230",
   "entry_point": "api.Service.GitHubInstallationVerifier dependency field",
   "module_kind": "service struct dependency injection"
  },
  {
   "where": "internal/config/config.go:379-382",
   "entry_point": "config.Load (IDENTRAIL_GITHUB_APP_OAUTH_CLIENT_ID / _CLIENT_SECRET)",
   "module_kind": "config_loader"
  },
  {
   "where": "internal/runtime/service_builder.go:268-274",
   "entry_point": "BuildScanServiceWithContext (composition root)",
   "module_kind": "composition_root"
  },
  {
   "where": "web/src/api/client.ts:5197-5202",
   "entry_point": "completeGitHubConnector request type",
   "module_kind": "web_client"
  },
  {
   "where": "web/src/productShell.tsx:2174-2189",
   "entry_point": "ProductGitHubCallbackPage (post-install browser callback)",
   "module_kind": "web_client"
  }
 ],
 "O1_entry_points": 2,
 "O2_out_of_scope_site": {
  "kind": "second_implementation",
  "where": "internal/api/github_connect.go:781"
 },
 "O3_reason_to_dismiss": "The project-scoped route is documented as internal compatibility code that new UI, docs and automation must not depend on (docs/auth/github-connector.md:20), so a solver can leave CompleteGitHubConnection - and the X-GitHub-Installation-ID fallback in the neighbouring router file - alone as a legacy path the advisory is not about.",
 "O4_distance": {
  "files": 6,
  "packages": 5,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Reloading an already-connected GitHub App connector from persisted state must keep working with no OAuth code available: githubConnectionFromStored runs on every cache miss, on repo-selection updates, on webhook secret rotation, and in the worker before minting a clone token (internal/api/service.go:2271-2291). An over-broad fix that demands ownership proof wherever installation_id is used breaks all existing connectors.",
  "where": "internal/api/github_connect.go:1746-1797"
 },
 "O6_input_shapes": [
  "installation_id as a JSON number in the completion body",
  "installation_id as the X-GitHub-Installation-ID header string, used only when the body value is 0 (internal/api/router.go:2225-2232 and 3654-3661; the fix deletes this fallback)",
  "OAuth code appended to the post-install redirect and sent as the new code field",
  "client-supplied account_login, which the fix replaces with the GitHub-verified account login",
  "missing/empty code and installation_id <= 0, which the fix rejects"
 ],
 "O7_producer": {
  "kind": "serializer",
  "where": "internal/api/github_connect.go:1664-1690",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "internal/api/github_connect.go:547",
   "sibling": "A PAT-connector route that also accepts an installation_id to link a PAT to an existing App installation",
   "why_realistic": "UpsertGitHubPATConnector writes the same connector type and status shape as the App flow into the same project, so a maintainer adding 'reuse my installation' there would set the id from the request without an OAuth proof."
  },
  {
   "where": "internal/api/github_connect.go:1289",
   "sibling": "An installation.created branch in the installation webhook that binds that installation to a project",
   "why_realistic": "The signed webhook already carries installation.id and account.login and the neighbouring markGitHubInstallationDisconnected branch already rewrites connector metadata from it, so auto-provisioning on install looks natural there."
  },
  {
   "where": "internal/runtime/service_builder.go:268-274",
   "sibling": "A second composition root (worker/CLI builder) that constructs api.Service without the verifier",
   "why_realistic": "The verifier is injected in exactly one builder, so a sibling builder copied from it would silently fall back to the old trust unless the fail-closed nil check is remembered."
  }
 ],
 "O9_family": "CWE-639 cross-tenant IDOR / CWE-862 missing authorization on GitHub App installation binding",
 "O9_dos": false,
 "O10_build": {
  "language": "Go (with a TypeScript web app in web/)",
  "toolchain": "go 1.25.11 (go.mod:3); make test -> go test ./... (Makefile:47-48); npm ci/build for web (Makefile:53-60)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "internal/api/github_connect_test.go and internal/api/github_connector_v2_test.go drive the router with an in-memory store and a fake GitHub repository lister; internal/connectors/github/{repositories,app,posture}_test.go use httptest servers. The fix's new OAuth tests (internal/connectors/github/oauth_test.go) are not present at the pinned commit."
 },
 "O11_fix_minutes": 55,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "internal/api/github_connect.go, internal/api/router.go, internal/api/service.go, internal/config/config.go, internal/connectors/github/oauth.go, internal/runtime/service_builder.go, web/src/api/client.ts, web/src/productShell.tsx",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Add a code field and a /user/installations ownership check only inside the newer POST /v1/connectors/github/complete handler, leaving the legacy CompleteGitHubConnection and the X-GitHub-Installation-ID fallback trusting the body value."
 },
 "out_of_scope_notes": [
  "The same fix also edits terraform, helm, systemd, docker, workflow, manifest, script and docs files; these are deployment/config plumbing for the new OAuth credential, not part of the protected operation, and were not pursued."
 ],
 "unverified": [
  "repo_mb unknown: no shell available to measure the tree size; the tree has roughly a thousand Go files plus a large web/ and openapi spec, so it is clearly above the 5 MB tiny_repo line but the exact figure was not taken.",
  "Build and tests were not executed (Bash disabled in this session); buildability is inferred from go.mod:3, Makefile:47-60 and the pinned tree being a single Go module.",
  "No latest release tree was supplied, so no present_in_latest observation was possible; O8 is empty so none was required.",
  "j_defence_ineffective is set to 1 on the reading that the V2 completion's state-only, unscoped pending-connector lookup (internal/api/github_connect.go:459-480) was the only authorization check and did not bind the caller; the fix adds a caller-tenant comparison there."
 ]
}
  ```
- Published fix sites:   - internal/api/github_connect.go:447-545 — entry point: POST /v1/connectors/github/complete [http_handler (internal/api), connector completion service method]
  - internal/api/github_connect.go:781-858 — entry point: POST /v1/workspaces/{workspace_id}/projects/{project_id}/github/connect/complete [http_handler (internal/api), second (legacy project-scoped) implementation of the same completion]
  - internal/api/router.go:2225-2232 — entry point: POST /v1/connectors/github/complete (header fallback path) [http_router: X-GitHub-Installation-ID string fallback removed]
  - internal/api/router.go:3654-3661 — entry point: POST /v1/workspaces/{workspace_id}/projects/{project_id}/github/connect/complete (header fallback path) [http_router: X-GitHub-Installation-ID string fallback removed]
  - fix.diff:1344 — entry point: UserOAuthClient.VerifyInstallationOwnership (new public connector API, internal/connectors/github/oauth.go) [connector_client / lower_level_api, new package file absent at pinned commit]
  - internal/api/service.go:225-230 — entry point: api.Service.GitHubInstallationVerifier dependency field [service struct dependency injection]
  - internal/config/config.go:379-382 — entry point: config.Load (IDENTRAIL_GITHUB_APP_OAUTH_CLIENT_ID / _CLIENT_SECRET) [config_loader]
  - internal/runtime/service_builder.go:268-274 — entry point: BuildScanServiceWithContext (composition root) [composition_root]
  - web/src/api/client.ts:5197-5202 — entry point: completeGitHubConnector request type [web_client]
  - web/src/productShell.tsx:2174-2189 — entry point: ProductGitHubCallbackPage (post-install browser callback) [web_client]
- Uncovered routes to confirm (pattern B): none
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

## Environment (`tasks/identrail-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/identrail-s4/instruction.md`)
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

## Tests (`tasks/identrail-s4/tests/`)
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
- **Wrong-fix patches** go in `build/identrail-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/identrail-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/identrail-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `A`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/identrail-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py identrail-s4 --only static
python3 -I common/gate/gate.py identrail-s4 --only nop
python3 -I common/gate/gate.py identrail-s4 --only oracle
python3 -I common/gate/gate.py identrail-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/identrail-s4/`;
  - edit only `tasks/identrail-s4/`, `build/identrail-s4/` and, for pattern B, the register;
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
