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

Project root: `/home/mara/cwe-bench`. Task: `jodit-s4`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-5957-5C94-3V7W", "CVE-2026-54756"]; xdan/jodit; prototype pollution in recursive configuration merge (CWE-1321)
- Pinned (vulnerable) commit: 3b75c6661940424b6693c1640edbd8ca0ce8da2d. Published fix: d298397bc993793b17145806c15f7dae53f90104.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash",
 "entry_id": "8650",
 "advisory_ids": [
  "GHSA-5957-5C94-3V7W",
  "CVE-2026-54756"
 ],
 "repo": "xdan/jodit",
 "pinned_commit": "3b75c6661940424b6693c1640edbd8ca0ce8da2d",
 "fix_commits": [
  "d298397bc993793b17145806c15f7dae53f90104"
 ],
 "trust_decision": {
  "summary": "Trusted as a real, single-commit published fix for a genuine flaw: at the pinned commit ConfigMerge copies source keys straight into the target, and for a key named '__proto__' the target's inherited Object.prototype is itself accepted as a plain object by isPlainObject, so the merge recurses into Object.prototype and writes there; Jodit.configure is a public entry point into exactly that. The fix adds one shared key filter inside both ConfigMerge and ConfigProto. Scope is thin: the ConfigProto site is behaviourally indistinguishable before and after the fix, so the only additional testable route is the untouched public path-writer set().",
  "evidence": [
   "src/jodit.ts:256-258",
   "src/core/helpers/utils/config-proto.ts:146-157",
   "src/core/helpers/utils/config-proto.ts:151-152",
   "src/core/helpers/checker/is-plain-object.ts:18-29",
   "src/config.ts:1165-1167",
   "src/config.ts:136-139",
   "src/core/helpers/utils/set.ts:40-52",
   "fix.diff:90-94",
   "fix.diff:103-105",
   "fix.diff:114-116"
  ]
 },
 "landing_point": {
  "where": "src/core/helpers/utils/config-proto.ts:146-157",
  "why": "The advisory summary names ConfigMerge explicitly and Jodit.configure forwards straight to it (src/jodit.ts:257); ConfigMerge:151-155 is the recursive write that reaches Object.prototype, so this is the first correct place to read after the summary."
 },
 "fix_sites": [
  {
   "where": "src/core/helpers/utils/config-proto.ts:146-157",
   "entry_point": "Jodit.configure() (src/jodit.ts:256-258, public static API) and Jodit.modules.Helpers.ConfigMerge (exported via src/modules/index.ts:14,30)",
   "module_kind": "core helper / in-place config merge, reached from a public static API and from the public helper namespace"
  },
  {
   "where": "src/core/helpers/utils/config-proto.ts:51-100",
   "entry_point": "Jodit.make()/new Jodit(..., options) -> initOptions (src/jodit.ts:1221-1224) and Jodit.modules.Helpers.ConfigProto; also every component that merges its own options (src/core/view/view.ts:298-302, src/modules/uploader/uploader.ts:300-306, src/core/request/ajax.ts:51-54, src/modules/dialog/dialog.ts:709-711, src/modules/file-browser/file-browser.ts:363)",
   "module_kind": "second merge implementation / defaults-or-merge route (prototype-chain variant used at editor creation)"
  },
  {
   "where": "fix.diff:90-94",
   "entry_point": "n/a - new shared predicate isUnsafeProtoKey + UNSAFE_PROTO_KEYS list used by both merge functions",
   "module_kind": "new internal helper in src/core/helpers/utils/config-proto.ts"
  }
 ],
 "O1_entry_points": 4,
 "O2_out_of_scope_site": {
  "kind": "second_implementation",
  "where": "src/core/helpers/utils/config-proto.ts:51-100 (ConfigProto - the prototype-chain merge used at editor creation)"
 },
 "O3_reason_to_dismiss": "An engineer can fix only the function the advisory names (ConfigMerge, reached from Jodit.configure) and argue ConfigProto is a different, prototype-chain-based mechanism: it only assigns __proto__ onto a fresh object which is then overwritten by Object.setPrototypeOf (config-proto.ts:97), so by itself it cannot touch Object.prototype.",
 "O4_distance": {
  "files": 2,
  "packages": 1,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "ConfigProto's documented prototype-chain fallback and Jodit.atom() atomic replacement must keep working: partial nested options inherit untouched defaults through the object prototype, and values wrapped with Jodit.atom() (non-enumerable isAtom flag) replace instead of merge. A fix that deep-clones/JSON-round-trips the merge, or skips every key that also exists on the target's prototype chain, drops inherited defaults, functions and the isAtom marker and breaks the existing two-level controls-merge test.",
  "where": "src/core/helpers/utils/config-proto.ts:83-97; src/core/helpers/utils/extend.ts:13-29; existing tests src/core/helpers/helpers.test.js:866-886 and src/core/helpers/helpers.test.js:1037-1067"
 },
 "O6_input_shapes": [
  "An own '__proto__' key produced by JSON.parse (not by an object literal), nested at least one level under an existing plain-object option such as 'controls' - this is the shape that actually reaches Object.prototype; the advisory example uses it (fix.diff:26-39)",
  "A bare top-level '__proto__' key is NOT the global path through Jodit.configure: target[key] resolves to Config.prototype, which isPlainObject rejects (src/config.ts:1165-1167, src/core/helpers/checker/is-plain-object.ts:25-28), so the write only changes defaultOptions' own prototype",
  "A 'constructor' -> 'prototype' chain (fix.diff:41-53) and a bare 'prototype' key (fix.diff:90) - the fix filters them, but on a plain target they only create own local properties, so these shapes do not by themselves mutate Object.prototype",
  "Any nesting depth, because the filter runs inside the recursive forEach of both merge functions, not once at the entry point",
  "Not a shape the fix needs or handles: array-wrapped payloads (ConfigMerge replaces arrays instead of recursing, config-proto.ts:151-155) and object-literal {__proto__: ...} input, which creates no own key at all"
 ],
 "O7_producer": {
  "kind": "none",
  "where": "",
  "check_calls_producer": null
 },
 "O8_uncovered_routes": [
  {
   "route": "Jodit.modules.Helpers.set(chain, value, obj) writes the last dotted segment into obj; a '__proto__' segment resolves to Object.prototype (isPlainObject accepts it and isArray rejects it, set.ts:43), so set('__proto__.polluted', 'yes', {}) mutates Object.prototype globally - and this public helper is jodit's own way of writing nested option values",
   "where": "src/core/helpers/utils/set.ts:30-53",
   "reason_to_dismiss": "The dotted chain is developer-supplied (the in-tree callers pass fixed literals such as file-browser/data-provider.ts:347), so an engineer can argue this is a path-writer, not configuration merging, and outside the advisory's property.",
   "distance": "1 file from the fix, same src/core/helpers/utils directory; exported as a public helper (src/core/helpers/utils/index.ts:35, src/modules/index.ts:30, listed in src/jodit.test.js:195)",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "src/core/helpers/utils/set.ts:30-53",
   "sibling": "A path-writer helper that takes its dotted chain from external data instead of a literal",
   "why_realistic": "The helper is already documented and used as the public way to write nested option values (Jodit.modules.Helpers.set, called with a path into this.options at src/modules/file-browser/data-provider.ts:347), so a config-import or deep-link feature would naturally pass a caller-supplied path."
  },
  {
   "where": "src/modules/file-browser/builders/item.ts:24-29",
   "sibling": "Copying every key of a server JSON item onto a shared cache/defaults object instead of onto the item instance",
   "why_realistic": "File-browser items arrive as remote JSON (data-provider.ts:116-119) and the constructor already copies keys blindly; a maintainer adding a per-source item cache or a defaults object for item fields would reuse the same loop with a shared target."
  },
  {
   "where": "src/core/storage/engines/local-storage-provider.ts:57-69",
   "sibling": "A JSON-round-trip store that writes a caller-supplied key into a module-level or shared config object rather than a freshly parsed root",
   "why_realistic": "This provider already parses a JSON root object and writes json[key] = value with a caller-controlled key (line 61-63); a persisted-settings variant keeping one root object for all editors would turn the same line into prototype pollution."
  },
  {
   "where": "src/core/event-emitter/observable.ts:106-143",
   "sibling": "Building observable accessors from the keys of an option sub-object taken straight from user config",
   "why_realistic": "Observable objects are created from arbitrary option objects (synces), and initAccessors copies each key into a local store and redefines it on the dict; a nested-observable change would run it over user-supplied option trees."
  }
 ],
 "O9_family": "prototype pollution in recursive configuration merge (CWE-1321)",
 "O9_dos": false,
 "O10_build": {
  "language": "TypeScript",
  "toolchain": "npm + make (cross-platform Makefile delegating to make.js), webpack 5 with tsx/swc loaders, TypeScript 6; tests via karma + mocha + chai in a headless browser (npm test -> make test browsers=chrome_headless)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "src/core/helpers/helpers.test.js: ConfigProto/ConfigFlatten/ConfigDeepFlatten suite (599-818), ConfigMerge suite (820-915), Jodit.configure suite (917-1067); the pollution tests added by the fix (fix.diff:26-39, 41-53, 61-72) are absent at the pinned commit"
 },
 "O11_fix_minutes": 30,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/core/helpers/utils/config-proto.ts",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 0,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Filter or delete unsafe keys once at the top of Jodit.configure() (or guard only the top level of ConfigMerge's source before looping): the advisory payload is nested under 'controls', so the recursion still reaches Object.prototype, and nothing is added at the untouched public path-writer set()."
 },
 "out_of_scope_notes": [
  "The fixed commit also edits CHANGELOG.md and test/loader.js (adds src/plugins/select-cells/select-cells.test.js to the karma case list) - release/test plumbing, not part of the security fix.",
  "Components reach ConfigProto with their own constructor options (src/core/view/view.ts:298-302 and the overrides listed in fix_sites); these are caller entry points I folded into O1's editor-creation entry point rather than counting separately."
 ],
 "unverified": [
  "Repo size in MB: no shell was available, so O4.repo_mb is null and tiny_repo/giant_repo were left unflagged; the tree is ~1200 files, well beyond a small library.",
  "The project's karma test run was not executed (no running of project code, and it needs a local Chrome/Firefox binary); O10.project_tests comes from reading the test files.",
  "present_in_latest for the O8 set() route: no latest tree and no network were provided ('latest release: none'), so it is unknown whether set() gained a filter later.",
  "Whether a hidden behavioural test can discriminate the ConfigProto site: by reading, the pre-fix __proto__ assignment only changes the fresh object's prototype, which config-proto.ts:97 immediately overwrites with the defaults prototype, so no observed value differs pre/post fix - this is a static reading, not a run."
 ]
}
  ```
- Published fix sites:   - src/core/helpers/utils/config-proto.ts:146-157 — entry point: Jodit.configure() (src/jodit.ts:256-258, public static API) and Jodit.modules.Helpers.ConfigMerge (exported via src/modules/index.ts:14,30) [core helper / in-place config merge, reached from a public static API and from the public helper namespace]
  - src/core/helpers/utils/config-proto.ts:51-100 — entry point: Jodit.make()/new Jodit(..., options) -> initOptions (src/jodit.ts:1221-1224) and Jodit.modules.Helpers.ConfigProto; also every component that merges its own options (src/core/view/view.ts:298-302, src/modules/uploader/uploader.ts:300-306, src/core/request/ajax.ts:51-54, src/modules/dialog/dialog.ts:709-711, src/modules/file-browser/file-browser.ts:363) [second merge implementation / defaults-or-merge route (prototype-chain variant used at editor creation)]
  - fix.diff:90-94 — entry point: n/a - new shared predicate isUnsafeProtoKey + UNSAFE_PROTO_KEYS list used by both merge functions [new internal helper in src/core/helpers/utils/config-proto.ts]
- Uncovered routes to confirm (pattern B):   - src/core/helpers/utils/set.ts:30-53 — Jodit.modules.Helpers.set(chain, value, obj) writes the last dotted segment into obj; a '__proto__' segment resolves to Object.prototype (isPlainObject accepts it and isArray rejects it, set.ts:43), so set('__proto__.polluted', 'yes', {}) mutates Object.prototype globally - and this public helper is jodit's own way of writing nested option values (reason to dismiss: The dotted chain is developer-supplied (the in-tree callers pass fixed literals such as file-browser/data-provider.ts:347), so an engineer can argue this is a path-writer, not configuration merging, and outside the advisory's property.; still in latest: unknown)
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

## Environment (`tasks/jodit-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/jodit-s4/instruction.md`)
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

## Tests (`tasks/jodit-s4/tests/`)
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
- **Wrong-fix patches** go in `build/jodit-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/jodit-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/jodit-s4/manifest.json`:**
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

**Also in `build/jodit-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py jodit-s4 --only static
python3 -I common/gate/gate.py jodit-s4 --only nop
python3 -I common/gate/gate.py jodit-s4 --only oracle
python3 -I common/gate/gate.py jodit-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/jodit-s4/`;
  - edit only `tasks/jodit-s4/`, `build/jodit-s4/` and, for pattern B, the register;
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
