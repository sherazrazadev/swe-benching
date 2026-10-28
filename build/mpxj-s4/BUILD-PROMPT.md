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

Project root: `/home/mara/cwe-bench`. Task: `mpxj-s4`. Pattern: `A`. Track: `injected`.

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
- Advisory: ["GHSA-7952-GX68-CJQR", "CVE-2026-65829", "PYSEC-2026-4108"]; joniles/mpxj; path_traversal (CWE-22, archive-entry path traversal / Zip Slip)
- Pinned (vulnerable) commit: 4785c84553081796e8aaa206ddbdb10885736a59. Published fix: 4347315afab1ef5a2907978a754fbc5b0ff58e6f.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash",
 "entry_id": "1749",
 "advisory_ids": [
  "GHSA-7952-GX68-CJQR",
  "CVE-2026-65829",
  "PYSEC-2026-4108"
 ],
 "repo": "joniles/mpxj",
 "pinned_commit": "4785c84553081796e8aaa206ddbdb10885736a59",
 "fix_commits": [
  "4347315afab1ef5a2907978a754fbc5b0ff58e6f"
 ],
 "trust_decision": {
  "summary": "The entry name read out of the archive header of a PRX/STX stream is untrusted and must be resolved to a path inside the extraction temp directory before any file is created or decompressed; the decision is taken per extracted entry in the two readers' extractFile methods and centralised in FileHelper.validateTargetFileIsInParentDirectory.",
  "evidence": [
   "src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java:102",
   "src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java:90",
   "src/main/java/org/mpxj/common/InputStreamHelper.java:192-198",
   "src/main/java/org/mpxj/common/FileHelper.java:125-131",
   "fix.diff:35-41"
  ]
 },
 "landing_point": {
  "where": "src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java:102",
  "why": "The advisory summary names the Primavera P3 PRX reader first; this is the line where the 13-byte NUL-terminated name taken straight from the entry header becomes a File that is then created (line 106) or decompressed into (line 110)."
 },
 "fix_sites": [
  {
   "where": "fix.diff:35",
   "entry_point": "org.mpxj.common.FileHelper.validateTargetFileIsInParentDirectory (new public static helper, called from both readers and from the zip extractor)",
   "module_kind": "shared helper in org.mpxj.common (looks out of scope for a Primavera advisory)"
  },
  {
   "where": "src/main/java/org/mpxj/common/InputStreamHelper.java:195",
   "entry_point": "org.mpxj.reader.UniversalProjectReader.read(InputStream) / getProjectReaderProxy(InputStream) via handleZipFile (UniversalProjectReader.java:709-714)",
   "module_kind": "shared helper - pre-existing zip-slip guard refactored onto the new FileHelper method (behaviour unchanged)"
  },
  {
   "where": "src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java:102",
   "entry_point": "org.mpxj.primavera.p3.P3PRXFileReader.read(InputStream) (plus read(File)/read(String) inherited from AbstractProjectStreamReader)",
   "module_kind": "reader"
  },
  {
   "where": "src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java:90",
   "entry_point": "org.mpxj.primavera.suretrak.SureTrakSTXFileReader.read(InputStream) (plus read(File)/read(String) inherited from AbstractProjectStreamReader)",
   "module_kind": "reader (second implementation of the same extraction mechanism, different package and different header layout)"
  }
 ],
 "O1_entry_points": 3,
 "O2_out_of_scope_site": {
  "kind": "second_implementation",
  "where": "src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java:81-103"
 },
 "O3_reason_to_dismiss": "The report and its reproducer concern a P3 PRX file, so the SureTrak STX reader in another package can be called a separate, older, less-used format that the advisory did not really cover.",
 "O4_distance": {
  "files": 4,
  "packages": 3,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Extraction must keep working for legitimate names: zip entries legitimately use nested sub-directory names and directory entries that are created with mkdirsQuietly (InputStreamHelper.java:200-204), and PRX/STX entries must keep their names verbatim in the flat temp directory because the downstream database readers identify projects purely by filename suffix ('STR.P3' at P3DatabaseReader.java:105, '.DIR' at SureTrakDatabaseReader.java:112). A fix that rejects names containing separators, or that rewrites/strips names to a basename, breaks reading zipped schedules and real P3/SureTrak databases.",
  "where": "src/main/java/org/mpxj/common/InputStreamHelper.java:200-204; src/main/java/org/mpxj/primavera/p3/P3DatabaseReader.java:105; src/main/java/org/mpxj/primavera/suretrak/SureTrakDatabaseReader.java:112"
 },
 "O6_input_shapes": [
  "NUL-terminated 13-byte file name field in a PRX entry header (P3PRXFileReader.java:96-102)",
  "NUL-terminated 260-byte file name field in an STX entry header (SureTrakSTXFileReader.java:83-90)",
  "entry with dataSize == 0, i.e. empty-file creation branch (P3PRXFileReader.java:104-107; SureTrakSTXFileReader.java:91-94)",
  "entry with dataSize > 0, i.e. PKWARE/Blast-decompressed payload written through an OutputStream (P3PRXFileReader.java:108-115; SureTrakSTXFileReader.java:95-102)",
  "relative traversal names ('../', nested 'a/../../x') as well as names that legitimately stay inside the directory",
  "zip entry names with nested sub-directories and directory entries, through the shared helper (InputStreamHelper.java:192-204)"
 ],
 "O7_producer": {
  "kind": "handler",
  "where": "src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java:94-102 and src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java:81-90 (the 13/260-byte name is decoded by getString in the same method that consumes it)",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java:104-115",
   "sibling": "A third branch/field inside the same entry loop that names a file to create or decompress (e.g. a long-name or sub-archive field handled after dataSize).",
   "why_realistic": "The PRX reader is a self-extracting archive parser whose entries already take two different write branches (empty file vs decompressed payload); a maintainer adding support for another PRX variant would naturally add one more name-to-file branch right here, and it would be easy to validate only the first field."
  },
  {
   "where": "src/main/java/org/mpxj/common/InputStreamHelper.java:89-113",
   "sibling": "A second archive-expansion helper next to writeZipStreamToTempDir (e.g. writeTarStreamToTempDir / writeGzipStreamToTempDir) that builds Files from entry names.",
   "why_realistic": "The project already treats archive expansion as a shared common-layer concern with one guard; supporting another container format is a routine addition, and a new helper is the obvious place for it."
  },
  {
   "where": "src/main/java/org/mpxj/reader/UniversalProjectReader.java:709-714",
   "sibling": "Another container/unwrapper fingerprint route (like the DOS self-extracting EXE path at UniversalProjectReader.java:924-963) that hands an archive stream to a reader which writes extracted entries.",
   "why_realistic": "UniversalProjectReader dispatches about twenty formats by fingerprint and already has a self-extracting-EXE wrapper; a new fingerprint wrapper is the project's standard idiom and would be easy to write without the guard."
  },
  {
   "where": "src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java:81-103",
   "sibling": "A third sister format reader copied from the STX/PRX pair (a PRX3 or legacy SureTrak variant) with its own fixed-width name field.",
   "why_realistic": "The two readers are near-verbatim copies of each other, so a third copy is the path of least resistance for a maintainer adding format support, and copying before the guard existed reproduces the flaw."
  }
 ],
 "O9_family": "path_traversal (CWE-22, archive-entry path traversal / Zip Slip)",
 "O9_dos": false,
 "O10_build": {
  "language": "Java",
  "toolchain": "Maven; maven-compiler-plugin with source/target 1.8 (pom.xml:304-312), surefire 2.22.2; dependencies POI, sqlite-jdbc, jackcess, jsoup, jackson, jaxb, jgoodies-binding, rtfparserkit",
  "services": [],
  "offline_after_build": true,
  "project_tests": "No tests exist for P3 PRX, SureTrak STX, the zip extractor or FileHelper at the pinned commit (no match for P3PRX/SureTrak/STX/validateTargetFile under src/test). The suite under src/test/java/org/mpxj/junit needs an external data directory (-Dmpxj.junit.datadir, MpxjTestData.java:40-59), so the only available checks are new behavioural tests written for the task."
 },
 "O11_fix_minutes": 25,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/main/java/org/mpxj/common/FileHelper.java, src/main/java/org/mpxj/common/InputStreamHelper.java, src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java, src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 0,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Add a 'name contains ..' string check (or strip to the basename) only in P3PRXFileReader.extractFile, the reader the report demonstrates, leaving SureTrakSTXFileReader, the dataSize==0 branch and the shared helper inconsistent."
 },
 "out_of_scope_notes": [
  "opc/OpcReader.java:189 and primavera/webservices/WebServicesReader.java:129 write to caller-supplied filenames rather than archive-derived names, so they are outside this advisory's protection."
 ],
 "unverified": [
  "repo_mb not measured (no shell in this session); tiny_repo/giant_repo red flags therefore not assessed.",
  "No PRX or STX sample file and no test scaffolding at the pinned commit, so end-to-end reachability of the two readers was established by reading code, not by running it.",
  "The latest release tree was not provided, so present_in_latest for routes cannot be checked (O8 is empty in any case)."
 ]
}
  ```
- Published fix sites:   - fix.diff:35 — entry point: org.mpxj.common.FileHelper.validateTargetFileIsInParentDirectory (new public static helper, called from both readers and from the zip extractor) [shared helper in org.mpxj.common (looks out of scope for a Primavera advisory)]
  - src/main/java/org/mpxj/common/InputStreamHelper.java:195 — entry point: org.mpxj.reader.UniversalProjectReader.read(InputStream) / getProjectReaderProxy(InputStream) via handleZipFile (UniversalProjectReader.java:709-714) [shared helper - pre-existing zip-slip guard refactored onto the new FileHelper method (behaviour unchanged)]
  - src/main/java/org/mpxj/primavera/p3/P3PRXFileReader.java:102 — entry point: org.mpxj.primavera.p3.P3PRXFileReader.read(InputStream) (plus read(File)/read(String) inherited from AbstractProjectStreamReader) [reader]
  - src/main/java/org/mpxj/primavera/suretrak/SureTrakSTXFileReader.java:90 — entry point: org.mpxj.primavera.suretrak.SureTrakSTXFileReader.read(InputStream) (plus read(File)/read(String) inherited from AbstractProjectStreamReader) [reader (second implementation of the same extraction mechanism, different package and different header layout)]
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

## Environment (`tasks/mpxj-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/mpxj-s4/instruction.md`)
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

## Tests (`tasks/mpxj-s4/tests/`)
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
- **Wrong-fix patches** go in `build/mpxj-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/mpxj-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/mpxj-s4/manifest.json`:**
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

**Also in `build/mpxj-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py mpxj-s4 --only static
python3 -I common/gate/gate.py mpxj-s4 --only nop
python3 -I common/gate/gate.py mpxj-s4 --only oracle
python3 -I common/gate/gate.py mpxj-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/mpxj-s4/`;
  - edit only `tasks/mpxj-s4/`, `build/mpxj-s4/` and, for pattern B, the register;
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
