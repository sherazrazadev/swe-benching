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

Project root: `/home/mara/cwe-bench`. Task: `swig-s4`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-2MF3-MR2R-R4VF"]; gina-io/swig; CWE-22 path traversal: arbitrary local file read through template include/extends/import paths
- Pinned (vulnerable) commit: a617cbf5f8c3cd5883d51ee4ef72d9d0523a2407. Published fix: 381bdc305e0b10e45368d56324328b9b4f7017fc.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "7564",
 "advisory_ids": [
  "GHSA-2MF3-MR2R-R4VF"
 ],
 "repo": "gina-io/swig",
 "pinned_commit": "a617cbf5f8c3cd5883d51ee4ef72d9d0523a2407",
 "fix_commits": [
  "381bdc305e0b10e45368d56324328b9b4f7017fc"
 ],
 "trust_decision": {
  "summary": "The filesystem template loader decides whether a requested template path is inside the configured basepath root: resolve() must only return identifiers under basepath, and it is the sole producer of identifiers for the fs reads in load(). At the pinned commit resolve() returns path.resolve(from, to) unconditionally, with no root check, and all four frontends (native, django, jinja2, twig) and every include/extends/import/from/compileFile/renderFile route funnel through this one resolver.",
  "evidence": [
   "packages/swig-core/lib/loaders/filesystem.js:28-35",
   "packages/swig-core/lib/loaders/filesystem.js:44-56",
   "packages/swig-core/lib/engine.js:377",
   "packages/swig-core/lib/engine.js:477",
   "packages/swig-core/lib/engine.js:547",
   "fix.diff:38-44"
  ]
 },
 "landing_point": {
  "where": "packages/swig-twig/lib/tags/include.js:128-136",
  "why": "The summary names include/extends path traversal, so a summary-only reader starts at the tag that turns a template path expression into a template load; each of the four frontends has its own include/extends tag (swig-core has none), so the named mechanism appears to live in four places while the actual decision is one package down in the shared loader at filesystem.js:28."
 },
 "fix_sites": [
  {
   "where": "packages/swig-core/lib/loaders/filesystem.js:28-35",
   "entry_point": "swig.loaders.fs(basepath).resolve / .load, reached by swig.compileFile / compileFileAsync / renderFile / renderFileAsync and by {% include %} / {% extends %} / {% import %} / {% from %} at render time",
   "module_kind": "shared loader in the core package (one layer below all four frontends; the root lib/loaders/filesystem.js is a one-line re-export of it)"
  }
 ],
 "O1_entry_points": 1,
 "O2_out_of_scope_site": {
  "kind": "none",
  "where": ""
 },
 "O3_reason_to_dismiss": "A solver can leave the no-basepath branch alone by arguing it has no declared root: the report's example and the published fix both assume a basepath, and `../` includes/extends across a template tree are the normal, shipped case under the default loader (tests/cases/extends_tests/extends_3.test.html:1), so only the basepath branch reads as 'the bug'.",
 "O4_distance": {
  "files": 3,
  "packages": 1,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Parent-relative `../` extends/include must keep working under the default filesystem loader (no basepath), where resolution is relative to the including file's directory; a fix that confines every resolve() to a root also breaks the template trees the project ships as test fixtures.",
  "where": "tests/cases/extends_tests/extends_3.test.html:1 and tests/cases/extends_layouts/extends_include.html:2, both compiled through the default no-basepath loader by tests/templates.test.js:63"
 },
 "O6_input_shapes": [
  "literal relative traversal string, e.g. '../../../etc/passwd' and '../secret.txt' (fix.diff:66-68)",
  "path supplied by an untrusted runtime local, `{% include leak %}` with locals {leak: '../secret.txt'} (fix.diff:103-106)",
  "sibling directory sharing the root's name prefix, '../views-secret/x.html' (fix.diff:69-70)",
  "caller-supplied `from` argument that cannot widen the root (fix.diff:71-72)",
  "the root directory itself as target, '.' (fix.diff:64-65)",
  "opt-out shape: third factory argument allowOutsideRoot = true restores pre-fix resolution (fix.diff:75-83)"
 ],
 "O7_producer": {
  "kind": "none",
  "where": "",
  "check_calls_producer": null
 },
 "O8_uncovered_routes": [
  {
   "route": "Default filesystem loader with no basepath: resolve() takes the `from`/process.cwd() branch and applies no confinement, so `{% include leak %}` (or extends/import) with an untrusted absolute path such as '/etc/passwd', or a path that climbs out of the template tree, is read from disk by the same load() sink.",
   "where": "packages/swig-core/lib/loaders/filesystem.js:31-34",
   "reason_to_dismiss": "the report's example and the fix both assume a basepath, so the no-basepath branch reads as having no declared root at all; and the shipped fixtures rely on `../` includes/extends with the default loader, so confining this branch looks like it would break legitimate templates (leaving the absolute-path case wide open).",
   "distance": "adjacent branch of the same resolver, but the report never mentions basepath, so nothing points at it",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "packages/swig-core/lib/loaders/memory.js:29-36",
   "sibling": "memory loader resolve() is a near-copy of the fs loader's, with the same basepath branch and no confinement",
   "why_realistic": "the two loaders implement one published contract with identical resolve bodies (only the fallback root differs), so a maintainer hardening loader paths would mirror the check here to keep the contract consistent"
  },
  {
   "where": "packages/swig-core/lib/loaders/index.js:9-22",
   "sibling": "a chroot/prefixing loader built from the documented custom-loader example whose resolve is plain path.resolve(from, to)",
   "why_realistic": "the loader docs publish exactly this shape as the way to write a loader, so a maintainer offering 'read templates only from this prefix' would add the check in a new loader of this form"
  },
  {
   "where": "packages/swig-core/lib/engine.js:542-556",
   "sibling": "a per-call root option on getTemplate/compileFileAsync (Express-style view root) that re-resolves the entry path",
   "why_realistic": "the helper already accepts a per-call resolveFrom option it could extend, and view engines commonly take a per-call root"
  }
 ],
 "O9_family": "CWE-22 path traversal: arbitrary local file read through template include/extends/import paths",
 "O9_dos": false,
 "O10_build": {
  "language": "JavaScript (Node.js, engines >=12; npm workspaces monorepo)",
  "toolchain": "npm install for workspaces + devDeps (esbuild, eslint, terser, express); `make test` runs node --test with tests/lib/mocha-compat.js; `make build` produces the browser bundle",
  "services": [],
  "offline_after_build": true,
  "project_tests": "tests/loaders.test.js (fs and memory loader API, including a basepath render), tests/templates.test.js (walks tests/cases/** and compiles every *.test.html with the default loader, including parent-relative extends), tests/tags/include.test.js, tests/tags/extend.test.js, tests/async/*; no path-confinement or traversal tests exist at the pinned commit"
 },
 "O11_fix_minutes": 20,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "packages/swig-core/lib/loaders/filesystem.js",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 0,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Add a cheap string test inside resolve() only when basepath is set (a raw `startsWith(basepath)` prefix check or a `to.indexOf('..') !== -1` throw), which lets a sibling dir with the same name prefix through, breaks relative basepaths, and leaves the no-basepath and absolute-path routes open."
 },
 "out_of_scope_notes": [
  "Nothing outside this advisory was pursued. Context only: this repository already uses the label CVE-2023-25345 for an unrelated prototype-property blocklist (packages/swig-core/lib/security.js:2-22) with existing regression tests in tests/regressions.test.js, which will act as a distractor when the advisory id is searched."
 ],
 "unverified": [
  "repo_mb: no shell available, so total size could not be measured; 574 tracked files, mostly small JS and markdown, so it may fall under the 5 MB tiny_repo threshold.",
  "The published fix compares an absolute `resolved` against path.normalize(basepath) (fix.diff:39-40). A relative basepath such as swig.loaders.fs('views') would therefore reject every path; not confirmed by execution, and no pinned test uses a relative basepath (tests/loaders.test.js:96,102 both use __dirname).",
  "Whether the no-basepath O8 route can be closed without breaking tests/cases/extends_tests/* was reasoned from the fixtures only, not executed; the fair form looks like rejecting absolute include paths when no basepath is configured.",
  "bin/swig.js:155 and bin/swig.js:446 read template files directly with fs, not through the loader. Considered and excluded from O8: the CLI is a local developer tool with no trust boundary over the paths it is given.",
  "Latest release for O8 is reported as none, so present_in_latest is unknown.",
  "No build or test run was performed (reading and searching only), so buildability and the 45-minute engineering estimate are judged from the Makefile, package.json and test layout."
 ]
}
  ```
- Published fix sites:   - packages/swig-core/lib/loaders/filesystem.js:28-35 — entry point: swig.loaders.fs(basepath).resolve / .load, reached by swig.compileFile / compileFileAsync / renderFile / renderFileAsync and by {% include %} / {% extends %} / {% import %} / {% from %} at render time [shared loader in the core package (one layer below all four frontends; the root lib/loaders/filesystem.js is a one-line re-export of it)]
- Uncovered routes to confirm (pattern B):   - packages/swig-core/lib/loaders/filesystem.js:31-34 — Default filesystem loader with no basepath: resolve() takes the `from`/process.cwd() branch and applies no confinement, so `{% include leak %}` (or extends/import) with an untrusted absolute path such as '/etc/passwd', or a path that climbs out of the template tree, is read from disk by the same load() sink. (reason to dismiss: the report's example and the fix both assume a basepath, so the no-basepath branch reads as having no declared root at all; and the shipped fixtures rely on `../` includes/extends with the default loader, so confining this branch looks like it would break legitimate templates (leaving the absolute-path case wide open).; still in latest: unknown)
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

## Environment (`tasks/swig-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/swig-s4/instruction.md`)
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

## Tests (`tasks/swig-s4/tests/`)
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
- **Wrong-fix patches** go in `build/swig-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/swig-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/swig-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `B`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/swig-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py swig-s4 --only static
python3 -I common/gate/gate.py swig-s4 --only nop
python3 -I common/gate/gate.py swig-s4 --only oracle
python3 -I common/gate/gate.py swig-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/swig-s4/`;
  - edit only `tasks/swig-s4/`, `build/swig-s4/` and, for pattern B, the register;
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
