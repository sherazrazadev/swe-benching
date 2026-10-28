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

Project root: `/home/mara/cwe-bench`. Task: `claude-mem-s4`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-5GVR-V6QV-H5MM", "CVE-2026-11330"]; thedotmack/claude-mem; CWE-327: risky hash construction - truncated digest over an ambiguous, unseparated concatenation used as a dedup identity (silent data loss on collision)
- Pinned (vulnerable) commit: 4509da1409376afa77102031b12df74c0aea476a. Published fix: f32fda8b35e9fe9329f87da65c31149362a03f97.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "8722",
 "advisory_ids": [
  "GHSA-5GVR-V6QV-H5MM",
  "CVE-2026-11330"
 ],
 "repo": "thedotmack/claude-mem",
 "pinned_commit": "4509da1409376afa77102031b12df74c0aea476a",
 "fix_commits": [
  "f32fda8b35e9fe9329f87da65c31149362a03f97"
 ],
 "trust_decision": {
  "summary": "The identity of an observation is decided by computeObservationContentHash: a 16-hex truncated SHA-256 of memorySessionId|title|narrative concatenated with no field boundary, and the dedup query trusts that string as an exact key (content_hash = ?), so two distinct observations whose fields re-split the same character stream are indistinguishable and one is silently dropped.",
  "evidence": [
   "src/services/sqlite/observations/store.ts:24-27",
   "src/services/sqlite/observations/store.ts:41",
   "src/services/sqlite/observations/store.ts:68-73",
   "src/services/sqlite/migrations/runner.ts:841",
   "plugin/scripts/worker-service.cjs:19"
  ]
 },
 "landing_point": {
  "where": "src/services/sqlite/observations/store.ts:19",
  "why": "The advisory names computeObservationContentHash, and that function exists only here; lines 24-27 hold the whole cause (unseparated concat plus slice(0,16))."
 },
 "fix_sites": [
  {
   "where": "src/services/sqlite/observations/store.ts:24-27",
   "entry_point": "POST /api/memory/save; POST /sessions/:sessionDbId/observations (+ /api/sessions/observations alias); exported storeObservation()/storeObservations()/storeObservationsAndMarkComplete(); bin import-xml-observations",
   "module_kind": "library / persistence module (sqlite observations store)"
  }
 ],
 "O1_entry_points": 4,
 "O2_out_of_scope_site": {
  "kind": "second_implementation",
  "where": "plugin/scripts/worker-service.cjs:19 and plugin/scripts/context-generator.cjs:9 (minified copies of the same hash: update((t||\"\")+(e||\"\")+(r||\"\")).digest(\"hex\").slice(0,16))"
 },
 "O3_reason_to_dismiss": "Both .cjs files are esbuild output bundled from src/services/worker-service.ts and src/services/context-generator.ts (scripts/build-hooks.js:16-27,98-103) and the repo's own build regenerates them, so a solver can argue 'fix the source and let npm run build handle the bundle' - which is also exactly why the shipped copies stay stale unless the fix touches them.",
 "O4_distance": {
  "files": 6,
  "packages": 2,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "The 30s dedup must keep collapsing genuinely identical repeat observations, and the persisted content_hash is a 16-char value with a non-unique index and pre-existing/backfilled rows; a fix that cuts a full 64-char digest, prefixes a version/scheme marker, or adds a nonce/timestamp to the key either stops dedup from ever matching or orphans every hash already stored, and the existing tests pin hash length at 16.",
  "where": "src/services/sqlite/observations/store.ts:39-43; tests/sqlite/data-integrity.test.ts:58-70,108-116"
 },
 "O6_input_shapes": [
  "field-boundary shift between title and narrative: (title=\"ab\", narrative=\"c\") vs (title=\"a\", narrative=\"bc\") hash identically",
  "null vs empty string: (null, null) and (\"\", \"\") both normalise to the same input",
  "boundary shift between memory_session_id and title",
  "truncation to a 16-hex (64-bit) prefix of the digest"
 ],
 "O7_producer": {
  "kind": "schema",
  "where": "src/services/sqlite/migrations/runner.ts:841 (migration 22 backfills content_hash with substr(hex(randomblob(8)),1,16)); duplicated at src/services/sqlite/SessionStore.ts:853",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [
  {
   "route": "POST /api/import stores observations through SessionStore.importObservation, which dedups on (memory_session_id, title, created_at_epoch) and inserts with content_hash NULL, so no content-derived identity is applied on that route at all",
   "where": "src/services/worker/http/routes/DataRoutes.ts:62,358 -> src/services/sqlite/SessionStore.ts:2364-2397 (duplicate implementation at src/services/sqlite/import/bulk.ts:126-189)",
   "reason_to_dismiss": "It is a restore/import path for an external database dump, not the live write path, it uses an exact-millisecond key of its own, and the advisory only names computeObservationContentHash, so it was never covered.",
   "distance": "another module (worker HTTP routes -> legacy SessionStore import method), 2 files and a package boundary away from the observations store module",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "Rows backfilled by migration 22 carry a random 16-hex content_hash that was never derived from their content, so a post-upgrade/save-reload re-insert of an existing observation can never match them",
   "where": "src/services/sqlite/migrations/runner.ts:839-843",
   "reason_to_dismiss": "The backfill comment says the random values are deliberate 'so they don't block new inserts', and SQL cannot recompute a SHA-256 in this schema, so a solver can call it a design choice rather than part of the collision fix.",
   "distance": "migration layer, a different file from the store module and only reachable on an existing database",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "src/services/sqlite/summaries/store.ts:20-34",
   "sibling": "A content-hash dedup for session_summaries mirroring the observation one",
   "why_realistic": "Summaries are written by the same worker transaction (transactions.ts:106-127) with no dedup at all, so a maintainer adding duplicate protection would copy computeObservationContentHash and inherit the same unseparated-concat identity."
  },
  {
   "where": "src/services/sync/ChromaSync.ts:158-176",
   "sibling": "A content-derived stable vector id for observation chunks instead of obs_${id}_narrative",
   "why_realistic": "The sync layer already needs a deterministic identity to upsert chunks and already imports observation content; hashing title/narrative/facts there is a natural next step and would repeat the same field-boundary ambiguity."
  },
  {
   "where": "src/services/sqlite/import/bulk.ts:126-189",
   "sibling": "A second dedup identity (session+title+exact epoch) for imported observations",
   "why_realistic": "This already exists as a divergent copy of the store path, so a maintainer unifying import with the live path would plausibly bolt the content hash onto it."
  }
 ],
 "O9_family": "CWE-327: risky hash construction - truncated digest over an ambiguous, unseparated concatenation used as a dedup identity (silent data loss on collision)",
 "O9_dos": false,
 "O10_build": {
  "language": "TypeScript (Bun runtime; bun:sqlite)",
  "toolchain": "bun >= 1.0 (bun install, bun test); npm run build = node scripts/sync-plugin-manifests.js && node scripts/build-hooks.js (esbuild bundles into plugin/scripts/*.cjs)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "tests/sqlite/data-integrity.test.ts covers this exact area (hash consistency, null handling, length 16, 30s dedup, content_hash populated); also tests/services/sqlite/migration-runner.test.ts:92-129 and tests/services/sqlite/schema-repair.test.ts. Run with bun test tests/sqlite/."
 },
 "O11_fix_minutes": 25,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/services/sqlite/observations/store.ts",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Hash only the field the report's example varies (narrative) or add a nonce/timestamp so hashes never collide - the visible tests stay green while the identity is still ambiguous or the 30s dedup stops working."
 },
 "out_of_scope_notes": [
  "scripts/translate-readme/index.ts:17 uses the same sha256().slice(0,16) shape as a translation-cache key; unrelated to observation identity and not pursued.",
  "src/services/sync/ChromaSync.ts derives vector ids from row ids (obs_${id}_narrative), not from content; a related identity question but outside this advisory's protection."
 ],
 "unverified": [
  "The supplied fix diff contains only the commit header for f32fda8b (a merge commit) and no hunks, so the exact published change (separator vs length-prefix vs full digest), whether tests were added or changed, and whether the plugin/scripts bundles were rebuilt in the fix are unknown.",
  "Repository size in MB could not be measured without a shell, so tiny_repo/giant_repo cannot be decided (repo_mb left null).",
  "No latest checkout was provided, so present_in_latest for both O8 routes is unknown.",
  "Whether any test invokes the minified plugin/scripts copy rather than src (i.e. whether the stale bundle is observable to a hidden behavioural test) was not checked."
 ]
}
  ```
- Published fix sites:   - src/services/sqlite/observations/store.ts:24-27 — entry point: POST /api/memory/save; POST /sessions/:sessionDbId/observations (+ /api/sessions/observations alias); exported storeObservation()/storeObservations()/storeObservationsAndMarkComplete(); bin import-xml-observations [library / persistence module (sqlite observations store)]
- Uncovered routes to confirm (pattern B):   - src/services/worker/http/routes/DataRoutes.ts:62,358 -> src/services/sqlite/SessionStore.ts:2364-2397 (duplicate implementation at src/services/sqlite/import/bulk.ts:126-189) — POST /api/import stores observations through SessionStore.importObservation, which dedups on (memory_session_id, title, created_at_epoch) and inserts with content_hash NULL, so no content-derived identity is applied on that route at all (reason to dismiss: It is a restore/import path for an external database dump, not the live write path, it uses an exact-millisecond key of its own, and the advisory only names computeObservationContentHash, so it was never covered.; still in latest: unknown)
  - src/services/sqlite/migrations/runner.ts:839-843 — Rows backfilled by migration 22 carry a random 16-hex content_hash that was never derived from their content, so a post-upgrade/save-reload re-insert of an existing observation can never match them (reason to dismiss: The backfill comment says the random values are deliberate 'so they don't block new inserts', and SQL cannot recompute a SHA-256 in this schema, so a solver can call it a design choice rather than part of the collision fix.; still in latest: unknown)
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

## Environment (`tasks/claude-mem-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/claude-mem-s4/instruction.md`)
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

## Tests (`tasks/claude-mem-s4/tests/`)
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
- **Wrong-fix patches** go in `build/claude-mem-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/claude-mem-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/claude-mem-s4/manifest.json`:**
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

**Also in `build/claude-mem-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py claude-mem-s4 --only static
python3 -I common/gate/gate.py claude-mem-s4 --only nop
python3 -I common/gate/gate.py claude-mem-s4 --only oracle
python3 -I common/gate/gate.py claude-mem-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/claude-mem-s4/`;
  - edit only `tasks/claude-mem-s4/`, `build/claude-mem-s4/` and, for pattern B, the register;
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
