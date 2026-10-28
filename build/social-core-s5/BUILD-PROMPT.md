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

Project root: `/home/mara/cwe-bench`. Task: `social-core-s5`. Pattern: `A+B`. Track: `injected`.

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
- Advisory: ["GHSA-VQG6-3FW6-J9JG", "CVE-2026-57179", "PYSEC-2026-4168"]; python-social-auth/social-core; Session fixation (CWE-384): login CSRF via cross-session resume of a stored partial pipeline token
- Pinned (vulnerable) commit: 6fcde2c2bf16b6fefb15316e4c9f7a9d9ddfd95b. Published fix: 0418782454ac7bbc6a9230ea21f7f5066fe89686.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash",
 "entry_id": "5847",
 "advisory_ids": [
  "GHSA-VQG6-3FW6-J9JG",
  "CVE-2026-57179",
  "PYSEC-2026-4168"
 ],
 "repo": "python-social-auth/social-core",
 "pinned_commit": "6fcde2c2bf16b6fefb15316e4c9f7a9d9ddfd95b",
 "fix_commits": [
  "0418782454ac7bbc6a9230ea21f7f5066fe89686"
 ],
 "trust_decision": {
  "summary": "A stored partial pipeline may be resumed only by the client session that created it, unless that pipeline step was recorded as an intentional external-resume flow (email validation) and the strategy confirms the external resume; the decision is made at resume time in social_core/utils.py:partial_pipeline_data by resolving the token and comparing it with PARTIAL_TOKEN_SESSION_NAME in the session.",
  "evidence": [
   "social_core/utils.py:185-189",
   "social_core/utils.py:191-216",
   "social_core/actions.py:96-100",
   "social_core/actions.py:176-182",
   "social_core/strategy.py:130-134",
   "fix.diff:1006-1011"
  ]
 },
 "landing_point": {
  "where": "social_core/utils.py:185-189",
  "why": "The advisory summary says partial-pipeline/session fixation, so an engineer looks at the token resolution in partial_pipeline_data: it takes partial_token from request data (or the explicit argument) and never compares it with the token stored in the session, then loads and returns that partial."
 },
 "fix_sites": [
  {
   "where": "social_core/utils.py:173-217",
   "entry_point": "social_core.utils.partial_pipeline_data (public utility API called by framework views)",
   "module_kind": "shared utility / public API"
  },
  {
   "where": "social_core/actions.py:96-104",
   "entry_point": "social_core.actions.do_complete (framework complete view)",
   "module_kind": "action handler"
  },
  {
   "where": "social_core/actions.py:176-186",
   "entry_point": "social_core.actions.do_disconnect (framework disconnect view)",
   "module_kind": "action handler"
  },
  {
   "where": "social_core/pipeline/partial.py:8-59",
   "entry_point": "partial_step decorator / partial alias applied to every partial pipeline step",
   "module_kind": "decorator / wrapper"
  },
  {
   "where": "social_core/pipeline/mail.py:13-37",
   "entry_point": "pipeline step social_core.pipeline.mail.mail_validation, reached from the auth pipeline and the email-validation link",
   "module_kind": "pipeline step"
  },
  {
   "where": "social_core/strategy.py:130-134",
   "entry_point": "BaseStrategy.clean_partial_pipeline plus the new external-resume confirmation hooks (framework strategy extension point)",
   "module_kind": "strategy base class / extension point"
  }
 ],
 "O1_entry_points": 2,
 "O2_out_of_scope_site": {
  "kind": "wrapper_or_composition",
  "where": "social_core/pipeline/partial.py:8-59"
 },
 "O3_reason_to_dismiss": "The partial_step decorator (and the mail_validation step that uses it) only records pipeline state and looks like a trusted internal helper rather than a request entry point, so a solver can treat the stored resume-policy flag as an implementation detail and leave the decorator, and the email-validation step's allow flag, untouched.",
 "O4_distance": {
  "files": 2,
  "packages": 2,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Resuming a halted pipeline from an emailed validation link in a fresh session (partial_token + verification_code in the request, no matching session token) must keep working; the fix keeps it alive by stamping allow_external_resume=True on that step's stored record only, so a blanket session-ownership check breaks email validation while a blanket allow reopens the hole.",
  "where": "social_core/pipeline/mail.py:13-37"
 },
 "O6_input_shapes": [
  "partial_token as a plain string in request body or query string",
  "MultiValueDict/QueryDict request data with list values, flattened with to_plain_dict and encoded with to_session_value",
  "no partial_token in the request at all, token only from PARTIAL_TOKEN_SESSION_NAME (ordinary in-session resume)",
  "partial_token passed as an explicit argument to partial_pipeline_data by a framework view",
  "custom token parameter name via SOCIAL_AUTH_PARTIAL_PIPELINE_TOKEN_NAME",
  "confirmation round trip: partial_pipeline_confirm parameter plus the pending token and original request data replayed from the session",
  "stored partial records with and without the allow_external_resume data flag",
  "stored partial whose backend/uid does not match the current backend or request"
 ],
 "O7_producer": {
  "kind": "serializer",
  "where": "social_core/pipeline/utils.py:60-71",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [
  {
   "route": "strategy.partial_load(token) followed by backend.continue_pipeline(partial) resumes a stored pipeline straight from a token with no session-ownership check; the fix guarded the actions/utils callers but left this sink and loader unchanged",
   "where": "social_core/backends/base.py:269-275",
   "reason_to_dismiss": "It is a lower-level library API used by framework integrations and by the project's own test harness, not a user-facing web route, so it can be argued outside the advisory's complete/disconnect handlers.",
   "distance": "same package, two files from the landing point (social_core/backends/base.py vs social_core/utils.py); loader at social_core/strategy.py:127-128",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "BaseOpenID.continue_pipeline override resumes the stored partial (and replays the OpenID assertion) without any session-ownership check, bypassing partial_pipeline_data entirely",
   "where": "social_core/backends/open_id.py:189-200",
   "reason_to_dismiss": "Legacy OpenID 2.0 backend with its own continue_pipeline override \u2014 an easy 'neighbouring/legacy path, not the login CSRF flow' dismissal.",
   "distance": "same top package, social_core/backends/open_id.py vs social_core/utils.py",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "social_core/pipeline/partial.py:45-50",
   "sibling": "A second external-resume step (e.g. phone/OTP validation) decorated with allow_external_resume=True, storing its own policy flag in the partial record.",
   "why_realistic": "The published fix sets the precedent that a pipeline step can opt into external resume, so a maintainer adding another out-of-band verification flow would copy the mail_validation pattern."
  },
  {
   "where": "social_core/backends/base.py:269-275",
   "sibling": "A second continue_pipeline override in another backend that reloads and resumes a partial from request-supplied token material.",
   "why_realistic": "open_id already overrides it; any backend that completes a deferred assertion would naturally override the same hook."
  },
  {
   "where": "social_core/actions.py:82-165",
   "sibling": "A sibling action handler (register/associate/email-validation) that calls partial_pipeline_data directly for a different framework view.",
   "why_realistic": "do_complete and do_disconnect are thin framework-agnostic actions; social-django/social-flask add their own views on top of the same helpers, so another action is the natural extension point."
  },
  {
   "where": "social_core/strategy.py:130-155",
   "sibling": "Another strategy-level override of the external-resume confirmation hooks for a different framework strategy.",
   "why_realistic": "The fix ships no-op confirmation hooks on BaseStrategy, explicitly inviting framework strategies to implement them; a second implementation is expected."
  }
 ],
 "O9_family": "Session fixation (CWE-384): login CSRF via cross-session resume of a stored partial pipeline token",
 "O9_dos": false,
 "O10_build": {
  "language": "Python (>=3.10)",
  "toolchain": "setuptools build backend, pytest 9 + pytest-cov/pytest-xdist, tox/uv in CI, optional libxmlsec1-dev for the SAML extra",
  "services": [],
  "offline_after_build": true,
  "project_tests": "social_core/tests/test_utils.py (PartialPipelineData), social_core/tests/test_partial.py, social_core/tests/actions/test_login.py, social_core/tests/actions/test_disconnect.py, social_core/tests/backends/base.py:147-175 (do_partial_pipeline); HTTP is mocked with responses"
 },
 "O11_fix_minutes": 75,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "A+B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "social_core/actions.py, social_core/utils.py, social_core/pipeline/partial.py, social_core/pipeline/mail.py, social_core/strategy.py",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Require the request partial_token to equal the session token (or reject any token supplied in the request) inside partial_pipeline_data \u2014 which kills emailed validation links and session-only resume, and still leaves the public partial_load + continue_pipeline route unguarded."
 },
 "out_of_scope_notes": [],
 "unverified": [
  "repo source size in MB could not be measured (no shell in this session); the tree has ~370 files so it is probably a few MB but tiny_repo is left unset",
  "no latest release code was provided ('none'), so present_in_latest for both O8 routes is unknown",
  "advisory text beyond the one-line summary was not available; the trust decision was derived from the fix diff and commit message"
 ]
}
  ```
- Published fix sites:   - social_core/utils.py:173-217 — entry point: social_core.utils.partial_pipeline_data (public utility API called by framework views) [shared utility / public API]
  - social_core/actions.py:96-104 — entry point: social_core.actions.do_complete (framework complete view) [action handler]
  - social_core/actions.py:176-186 — entry point: social_core.actions.do_disconnect (framework disconnect view) [action handler]
  - social_core/pipeline/partial.py:8-59 — entry point: partial_step decorator / partial alias applied to every partial pipeline step [decorator / wrapper]
  - social_core/pipeline/mail.py:13-37 — entry point: pipeline step social_core.pipeline.mail.mail_validation, reached from the auth pipeline and the email-validation link [pipeline step]
  - social_core/strategy.py:130-134 — entry point: BaseStrategy.clean_partial_pipeline plus the new external-resume confirmation hooks (framework strategy extension point) [strategy base class / extension point]
- Uncovered routes to confirm (pattern B):   - social_core/backends/base.py:269-275 — strategy.partial_load(token) followed by backend.continue_pipeline(partial) resumes a stored pipeline straight from a token with no session-ownership check; the fix guarded the actions/utils callers but left this sink and loader unchanged (reason to dismiss: It is a lower-level library API used by framework integrations and by the project's own test harness, not a user-facing web route, so it can be argued outside the advisory's complete/disconnect handlers.; still in latest: unknown)
  - social_core/backends/open_id.py:189-200 — BaseOpenID.continue_pipeline override resumes the stored partial (and replays the OpenID assertion) without any session-ownership check, bypassing partial_pipeline_data entirely (reason to dismiss: Legacy OpenID 2.0 backend with its own continue_pipeline override — an easy 'neighbouring/legacy path, not the login CSRF flow' dismissal.; still in latest: unknown)
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

## Environment (`tasks/social-core-s5/environment/Dockerfile`)
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

## Report to the solver (`tasks/social-core-s5/instruction.md`)
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

## Tests (`tasks/social-core-s5/tests/`)
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
- **Wrong-fix patches** go in `build/social-core-s5/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/social-core-s5/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/social-core-s5/manifest.json`:**
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

**Also in `build/social-core-s5/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py social-core-s5 --only static
python3 -I common/gate/gate.py social-core-s5 --only nop
python3 -I common/gate/gate.py social-core-s5 --only oracle
python3 -I common/gate/gate.py social-core-s5 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/social-core-s5/`;
  - edit only `tasks/social-core-s5/`, `build/social-core-s5/` and, for pattern B, the register;
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
