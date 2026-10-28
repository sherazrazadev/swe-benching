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

Project root: `/home/mara/cwe-bench`. Task: `cryptography-s4`. Pattern: `A`. Track: `injected`.

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
- Advisory: ["GHSA-M2H6-J472-RP4C", "CVE-2026-69248", "PYSEC-2026-3554"]; pyca/cryptography; Improper certificate validation (CWE-295): X.509 name-constraint enforcement for wildcard DNS SANs
- Pinned (vulnerable) commit: 194c94777d76162f7e162264fabae5dbd106277d. Published fix: 286c89128896fc043c68d9061891badbdfa25dd2, 4d035a4225965edeffd312079a510ef25fcfdcb2.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "4331",
 "advisory_ids": [
  "GHSA-M2H6-J472-RP4C",
  "CVE-2026-69248",
  "PYSEC-2026-3554"
 ],
 "repo": "pyca/cryptography",
 "pinned_commit": "194c94777d76162f7e162264fabae5dbd106277d",
 "fix_commits": [
  "286c89128896fc043c68d9061891badbdfa25dd2",
  "4d035a4225965edeffd312079a510ef25fcfdcb2"
 ],
 "trust_decision": {
  "summary": "Whether a wildcard DNS SAN satisfies a certificate's name constraint is decided in the DNS match arm of NameChain::evaluate_single_constraint, which normalises the SAN with DNSName::new (rejecting '*') and then applies one unsigned DNSConstraint::matches to both permittedSubtrees and excludedSubtrees.",
  "evidence": [
   "src/rust/cryptography-x509-verification/src/lib.rs:157-170",
   "src/rust/cryptography-x509-verification/src/types.rs:34-58",
   "src/rust/cryptography-x509-verification/src/types.rs:168-182",
   "src/rust/cryptography-x509-verification/src/lib.rs:230-257"
  ]
 },
 "landing_point": {
  "where": "src/rust/cryptography-x509-verification/src/lib.rs:158-169",
  "why": "It is the only place a DNS SAN is compared with a name constraint; it is reached from the permittedSubtrees loop (lib.rs:232) and the excludedSubtrees loop (lib.rs:250) inside evaluate_constraints, itself called from build_chain_inner when a chain certificate carries the nameConstraints extension (lib.rs:338-340)."
 },
 "fix_sites": [
  {
   "where": "src/rust/cryptography-x509-verification/src/lib.rs:157-170",
   "entry_point": "cryptography.x509.verification.ClientVerifier.verify / ServerVerifier.verify -> cryptography_x509_verification::verify (src/rust/src/x509/verify.rs:277,361 -> lib.rs:266)",
   "module_kind": "verification core (name-constraint evaluator)"
  },
  {
   "where": "src/rust/cryptography-x509-verification/src/lib.rs:230-240",
   "entry_point": "same verifier entry points; permittedSubtrees loop",
   "module_kind": "verification core (name-constraint evaluator)"
  },
  {
   "where": "src/rust/cryptography-x509-verification/src/lib.rs:248-257",
   "entry_point": "same verifier entry points; excludedSubtrees loop",
   "module_kind": "verification core (name-constraint evaluator)"
  },
  {
   "where": "src/rust/cryptography-x509-verification/src/types.rs:168-182",
   "entry_point": "public crate API cryptography_x509_verification::types::DNSConstraint::matches (pub mod types, lib.rs:13)",
   "module_kind": "matching primitive / lower-level public API"
  },
  {
   "where": "src/rust/cryptography-x509-verification/src/types.rs:122-141",
   "entry_point": "public crate API cryptography_x509_verification::types::DNSPattern (new/matches); the fix adds inner_name()",
   "module_kind": "matching primitive / lower-level public API"
  }
 ],
 "O1_entry_points": 2,
 "O2_out_of_scope_site": {
  "kind": "lower_level_api",
  "where": "src/rust/cryptography-x509-verification/src/types.rs:168"
 },
 "O3_reason_to_dismiss": "The wildcard behaviour lives in the public DNSConstraint matching primitive in a separate module (types.rs) that is also a general-purpose API; a solver can fix only the verifier caller in evaluate_single_constraint and argue the public types API must keep its current signature/semantics for its other consumers.",
 "O4_distance": {
  "files": 1,
  "packages": 0,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "A wildcard SAN that does not overlap an excludedSubtree must still verify: excluded `baz.bar.example.com` with SAN `*.example.com` must be accepted, and exact names must keep identical permits/excludes results. An over-broad fix that matches a wildcard against any constraint subtree (e.g. inner-name containment applied to both subtree kinds) silently stops excluding wildcard SANs that do overlap. The same DNSPattern::matches primitive must keep matching exactly one leftmost label because hostname/subject matching uses it.",
  "where": "src/rust/cryptography-x509-verification/src/types.rs:131-140"
 },
 "O6_input_shapes": [
  "exact DNS SAN (foo.example.com) - unchanged by the fix",
  "leftmost single-label wildcard SAN whose base is inside the permitted subtree (*.example.com under example.com or com) - must be permitted",
  "wildcard SAN under a permitted subtree more specific than its base (*.example.com under foo.example.com) - must not be permitted",
  "wildcard SAN overlapping an excluded subtree that is more specific (*.example.com under bar.example.com) - must be excluded",
  "wildcard SAN not overlapping an excluded subtree (baz.bar.example.com) - must not be excluded",
  "multi-label wildcard base (*.foo.example.com)",
  "case-insensitive names (rlabels compared with eq_ignore_ascii_case)",
  "malformed wildcard forms (*, f*o.example.com, foo.*.example.com) still rejected by DNSPattern::new"
 ],
 "O7_producer": {
  "kind": "none",
  "where": "",
  "check_calls_producer": null
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "src/rust/cryptography-x509-verification/src/policy/mod.rs:180-190",
   "sibling": "A second wildcard matcher (Subject::subject_alt_name_matches -> DNSPattern::matches) that would have to apply the same containment-vs-overlap rules",
   "why_realistic": "It is the same DNSPattern primitive in the same crate and already matches certificate SANs against a caller-supplied subject, so a maintainer adding name-constraint behaviour could plausibly reuse or mirror it here."
  },
  {
   "where": "src/rust/cryptography-x509-verification/src/policy/extension.rs:476-503",
   "sibling": "Normalisation or wildcard rejection of DNS constraint/SAN base names at nameConstraints extension-permit time",
   "why_realistic": "This validator already inspects the nameConstraints extension (non-empty subtrees, minimum/maximum) before the evaluator runs, so base-name normalisation or a 'wildcard constraints are unsupported' rule fits naturally there."
  },
  {
   "where": "src/rust/cryptography-x509/src/extensions.rs:148-158",
   "sibling": "A parsing-layer GeneralSubtree/NameConstraints producer that normalises base GeneralNames instead of leaving raw IA5Strings to the check",
   "why_realistic": "The check re-parses raw IA5Strings itself (lib.rs:159, name.rs:61 exposes UnvalidatedIA5String), so moving that normalisation into the parser is a natural refactor a maintainer could have written."
  },
  {
   "where": "src/rust/src/x509/verify.rs:309-318",
   "sibling": "A Python-binding-level re-match of the leaf SAN that could grow its own wildcard/name-constraint branch",
   "why_realistic": "ServerVerifier.verify already re-reads and re-matches the leaf SAN after chain building, so duplicating a wildcard rule there is plausible."
  }
 ],
 "O9_family": "Improper certificate validation (CWE-295): X.509 name-constraint enforcement for wildcard DNS SANs",
 "O9_dos": false,
 "O10_build": {
  "language": "Rust (crate cryptography-x509-verification) with Python bindings via pyo3/maturin",
  "toolchain": "cargo/rustc (edition and rust-version inherited from the workspace; the crate's Cargo.toml declares only path dependencies and once_cell) plus a Python build (pip/maturin) and OpenSSL or BoringSSL for the full package",
  "services": [],
  "offline_after_build": true,
  "project_tests": "Rust unit tests inside the crate (types.rs:568-596 test_dnsconstraint_new / test_dnsconstraint_matches, policy/mod.rs tests) run offline with `cargo test -p cryptography-x509-verification`; Python tests at tests/x509/verification/test_verification.py cover only basic verifier behaviour (no name-constraint cases), and tests/x509/verification/test_limbo.py drives name-constraint behaviour through C2SP/x509-limbo vectors cloned from GitHub by .github/actions/fetch-vectors/action.yml:16-18."
 },
 "O11_fix_minutes": 45,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/rust/cryptography-x509-verification/src/lib.rs, src/rust/cryptography-x509-verification/src/types.rs",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Replace DNSName::new(name.0) with DNSPattern::new(name.0) and compare the wildcard's inner name to the constraint for both subtree kinds, which accepts wildcard SANs but silently stops excluding wildcard SANs that overlap an excludedSubtree (the first stacked commit's approach)."
 },
 "out_of_scope_notes": [],
 "unverified": [
  "The advisory summary's symptom (verifier *accepts* a wildcard SAN and escapes permittedSubtrees) is not reproducible at the pinned commit: DNSName::new rejects '*' as a non-alphanumeric label (types.rs:45-56), so any wildcard DNS SAN under a DNS name constraint errors out at lib.rs:159-164. The stacked fix turns that fail-closed rejection into permits/excludes semantics; a report that only says 'accepts' does not match the pinned code, which is a fairness concern for the task.",
  "The supplied fix.diff concatenates two upstream commits whose contexts are not contiguous: commit 4d035a42 expects DNSConstraint::matches(&DNSPattern) as its pre-image, which does not exist at the pinned commit (pinned has matches(&DNSName) at types.rs:168), so the two hunks do not apply to the pinned tree as a single series.",
  "Repository size in MB was not measured (no shell utilities available in this session); the repository is certainly between the 5 MB and 1.5 GB thresholds.",
  "No latest tree is available (release: none), so present_in_latest / latest_where could not be checked; O8 is empty, so no per-route check was needed."
 ]
}
  ```
- Published fix sites:   - src/rust/cryptography-x509-verification/src/lib.rs:157-170 — entry point: cryptography.x509.verification.ClientVerifier.verify / ServerVerifier.verify -> cryptography_x509_verification::verify (src/rust/src/x509/verify.rs:277,361 -> lib.rs:266) [verification core (name-constraint evaluator)]
  - src/rust/cryptography-x509-verification/src/lib.rs:230-240 — entry point: same verifier entry points; permittedSubtrees loop [verification core (name-constraint evaluator)]
  - src/rust/cryptography-x509-verification/src/lib.rs:248-257 — entry point: same verifier entry points; excludedSubtrees loop [verification core (name-constraint evaluator)]
  - src/rust/cryptography-x509-verification/src/types.rs:168-182 — entry point: public crate API cryptography_x509_verification::types::DNSConstraint::matches (pub mod types, lib.rs:13) [matching primitive / lower-level public API]
  - src/rust/cryptography-x509-verification/src/types.rs:122-141 — entry point: public crate API cryptography_x509_verification::types::DNSPattern (new/matches); the fix adds inner_name() [matching primitive / lower-level public API]
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

## Environment (`tasks/cryptography-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/cryptography-s4/instruction.md`)
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

## Tests (`tasks/cryptography-s4/tests/`)
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
- **Wrong-fix patches** go in `build/cryptography-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/cryptography-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/cryptography-s4/manifest.json`:**
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

**Also in `build/cryptography-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py cryptography-s4 --only static
python3 -I common/gate/gate.py cryptography-s4 --only nop
python3 -I common/gate/gate.py cryptography-s4 --only oracle
python3 -I common/gate/gate.py cryptography-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/cryptography-s4/`;
  - edit only `tasks/cryptography-s4/`, `build/cryptography-s4/` and, for pattern B, the register;
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
