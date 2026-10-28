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

Project root: `/home/mara/cwe-bench`. Task: `phpsysinfo-s4`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-786W-P5PM-CVGH", "CVE-2026-55584"]; phpsysinfo/phpsysinfo; authorization bypass by spoofed client identity (IP allowlist bypass)
- Pinned (vulnerable) commit: d786ab251e326d9afb9f60906fcdaca8e716ad0e. Published fix: 019fa2d7e568ea11461adb4bd33da5dc87c4b9ab.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "32812",
 "advisory_ids": [
  "GHSA-786W-P5PM-CVGH",
  "CVE-2026-55584"
 ],
 "repo": "phpsysinfo/phpsysinfo",
 "pinned_commit": "d786ab251e326d9afb9f60906fcdaca8e716ad0e",
 "fix_commits": [
  "019fa2d7e568ea11461adb4bd33da5dc87c4b9ab"
 ],
 "trust_decision": {
  "summary": "One decision per HTTP request: may this client run phpSysInfo? read_config.php derives the client IP from the client-controlled X-Forwarded-For header, then the client-controlled Client-IP header, and only then from REMOTE_ADDR, and compares that value against the PSI_ALLOWED list; because the attacker-supplied headers outrank the socket address, any client can claim an allowlisted IPv4 address and pass the gate.",
  "evidence": [
   "read_config.php:39-40",
   "read_config.php:42-50",
   "read_config.php:53-79"
  ]
 },
 "landing_point": {
  "where": "read_config.php:42-50",
  "why": "The advisory names X-Forwarded-For and Client-IP; those header names occur exactly once in the whole tree, in this header-priority chain that feeds the PSI_ALLOWED comparison."
 },
 "fix_sites": [
  {
   "where": "read_config.php:42-50",
   "entry_point": "index.php:32, js.php:24, language/language.php:42 and xml.php:32 (xml.php only via WebpageXML::__construct -> Output::_checkConfig, includes/output/class.Output.inc.php:52) all include read_config.php and therefore execute this gate",
   "module_kind": "shared bootstrap include (config loader + access gate), loaded by every PHP entry point"
  }
 ],
 "O1_entry_points": 4,
 "O2_out_of_scope_site": {
  "kind": "defaults_or_merge_route",
  "where": "phpsysinfo.ini.new:44-48"
 },
 "O3_reason_to_dismiss": "The shipped phpsysinfo.ini.new is only a template that each operator edits per deployment, so a solver can treat the new trusted-proxy knob as documentation and implement the whole behaviour in read_config.php, leaving the deployed default unaware of TRUSTED_PROXIES.",
 "O4_distance": {
  "files": 0,
  "packages": 1,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Reverse-proxy deployment: when REMOTE_ADDR is the proxy's own address, the real client address exists only in X-Forwarded-For / Client-IP. Removing the header branch (the fastest fix) fails closed and denies every legitimate proxied client that PSI_ALLOWED is supposed to admit, and it leaves the already-broken multi-hop case permanently broken - a list in X-Forwarded-For makes ip2long fail, so the request is denied outright at read_config.php:53-57.",
  "where": "read_config.php:42-50"
 },
 "O6_input_shapes": [
  "single X-Forwarded-For value",
  "comma-separated X-Forwarded-For list, right-most element taken as the candidate",
  "X-Client-IP header, single value",
  "X-Client-IP header, comma-separated list",
  "IPv4-mapped IPv6 prefix ::ffff:",
  "TRUSTED_PROXIES entry as a bare IPv4 address",
  "TRUSTED_PROXIES entry as a CIDR network",
  "non-IP candidate value (rejected by ip2long, request falls back to REMOTE_ADDR instead of dying)",
  "no proxy headers present (REMOTE_ADDR used directly)"
 ],
 "O7_producer": {
  "kind": "config_loader",
  "where": "read_config.php:15-36",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [
  {
   "route": "tools/cputest.php prints the host's raw /proc/cpuinfo text (serial field masked) to any client; read_config.php and therefore PSI_ALLOWED is never loaded",
   "where": "tools/cputest.php:3-11",
   "reason_to_dismiss": "tools/README calls it a test utility ('Displays anonymized /proc/cpuinfo'), so it reads as an admin script to delete rather than a phpSysInfo page the allowlist covers",
   "distance": "1 package (tools/ vs repository root), 0 intervening files",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "tools/distrotest.php runs lsb_release and echoes every /etc/*-release file to any client without the IP allowlist",
   "where": "tools/distrotest.php:19-48",
   "reason_to_dismiss": "documented in tools/README as a distribution-testing helper ('Generates a txt file for distribution testing'), i.e. a developer tool, not the monitored application",
   "distance": "1 package (tools/ vs repository root), 0 intervening files",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "tools/phptest.php prints SERVER_SOFTWARE, the PHP version and the loaded extension list to any client without the IP allowlist",
   "where": "tools/phptest.php:32-44",
   "reason_to_dismiss": "documented as a PHP environment check-up helper ('Displays information about PHP'); it leaks fingerprint data rather than host state, so a solver can argue the allowlist never covered it",
   "distance": "1 package (tools/ vs repository root), 0 intervening files",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "includes/class.CommonFunctions.inc.php:407-429",
   "sibling": "A shared clientIp() resolver placed next to the existing readenv() $_SERVER accessor, used by a second consumer (an access/audit line or a plugin) as well as by the gate",
   "why_realistic": "readenv() is already the project's generic server-variable reader, so a maintainer refactoring the trusted-proxy logic would naturally grow a helper here and call it from more than one place, giving the same mechanism two call sites in different packages"
  },
  {
   "where": "templates/dynamic/css.php:16-25",
   "sibling": "An ALLOWED gate added to the only web-reachable script that serves files without bootstrapping the config",
   "why_realistic": "css.php is the one script under templates/ that is called directly by URL and never includes read_config.php; a maintainer extending it to serve templated parameters or images would plausibly bolt the same check on"
  },
  {
   "where": "tools/cputest.php:1-3",
   "sibling": "A 'require PSI_APP_ROOT/read_config.php' guard at the top of the host-information diagnostic scripts",
   "why_realistic": "these scripts ship inside the web root and print host data, so a maintainer who noticed the gap after this advisory would plausibly close it there too, in a separate package from the gate"
  },
  {
   "where": "phpsysinfo.ini.new:44-48",
   "sibling": "A second defaults-file knob (for example a per-feature restriction or a proxy-list variant) that only takes effect if the config loader's type coercion in read_config.php is understood",
   "why_realistic": "every security-relevant switch in this project is a MAIN-section ini key coerced by read_config.php:27-34, so adding the sibling in the template and forgetting the loader (or the reverse) is the project's own idiom"
  }
 ],
 "O9_family": "authorization bypass by spoofed client identity (IP allowlist bypass)",
 "O9_dos": false,
 "O10_build": {
  "language": "PHP (>=5.1.3 declared; Dockerfile:14 installs PHP 7.4 with Apache)",
  "toolchain": "none - plain PHP, no build step and no composer install (composer.json:6-18 declares only php and ext-* requirements)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "none - the only CI is PHP lint across 5.5-8.4 (.github/workflows/phplint.yml:22-43); no test/spec directory and no test covering read_config.php in the pinned tree"
 },
 "O11_fix_minutes": 30,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "read_config.php (source); phpsysinfo.ini.new (config template/defaults)",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Drop the X-Forwarded-For / Client-IP branch entirely and read REMOTE_ADDR only - it stops the bypass but silently denies every legitimate client that sits behind a reverse proxy."
 },
 "out_of_scope_notes": [
  "xml.php:42 echoes $_GET['callback'] straight after a /[^\\w\\?]/ test when JSONP mode is enabled - a reflected-script concern in a different protection than this advisory's allowlist; not pursued."
 ],
 "unverified": [
  "Repository size in MB could not be measured (no shell in this session), so O4.repo_mb is null and tiny_repo was not asserted; the tree has 1110 files, mostly gfx/*.png, with about 85 PHP files.",
  "Nothing was executed: every route and line above was established by reading the pinned tree, not by running phpSysInfo.",
  "Gate reachability is by reading only: index.php:32 and js.php:24 require read_config.php directly, language/language.php:42 includes it, and xml.php:32 reaches it indirectly through WebpageXML::__construct (includes/output/class.WebpageXML.inc.php:269-271) calling Output::_checkConfig (includes/output/class.Output.inc.php:52).",
  "O1 counts the four entry points that execute the flawed header-priority resolution; only index.php and xml.php serve host information, while js.php and language/language.php serve static assets through the same gate.",
  "phpsysinfo.ini.new is a shipped config template rather than source, so it is counted in O2 and j_sites_touched but not in fix_sites; the published fix edits it at fix.diff:5-28 and the code at fix.diff:37-92.",
  "tools/checkdistro.php also runs without the allowlist but iterates sample/distrotest, which is absent from the pinned tree, so it exposes nothing on a stock deployment and was not listed in O8.",
  "Whether a hidden test can drive the trusted-proxy branch offline is unconfirmed; with a local server REMOTE_ADDR is 127.0.0.1, so TRUSTED_PROXIES=127.0.0.1 plus a spoofed X-Forwarded-For would exercise it, but this was not run.",
  "present_in_latest is 'unknown' for all O8 routes because the brief states there is no latest release to compare against."
 ]
}
  ```
- Published fix sites:   - read_config.php:42-50 — entry point: index.php:32, js.php:24, language/language.php:42 and xml.php:32 (xml.php only via WebpageXML::__construct -> Output::_checkConfig, includes/output/class.Output.inc.php:52) all include read_config.php and therefore execute this gate [shared bootstrap include (config loader + access gate), loaded by every PHP entry point]
- Uncovered routes to confirm (pattern B):   - tools/cputest.php:3-11 — tools/cputest.php prints the host's raw /proc/cpuinfo text (serial field masked) to any client; read_config.php and therefore PSI_ALLOWED is never loaded (reason to dismiss: tools/README calls it a test utility ('Displays anonymized /proc/cpuinfo'), so it reads as an admin script to delete rather than a phpSysInfo page the allowlist covers; still in latest: unknown)
  - tools/distrotest.php:19-48 — tools/distrotest.php runs lsb_release and echoes every /etc/*-release file to any client without the IP allowlist (reason to dismiss: documented in tools/README as a distribution-testing helper ('Generates a txt file for distribution testing'), i.e. a developer tool, not the monitored application; still in latest: unknown)
  - tools/phptest.php:32-44 — tools/phptest.php prints SERVER_SOFTWARE, the PHP version and the loaded extension list to any client without the IP allowlist (reason to dismiss: documented as a PHP environment check-up helper ('Displays information about PHP'); it leaks fingerprint data rather than host state, so a solver can argue the allowlist never covered it; still in latest: unknown)
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

## Environment (`tasks/phpsysinfo-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/phpsysinfo-s4/instruction.md`)
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

## Tests (`tasks/phpsysinfo-s4/tests/`)
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
- **Wrong-fix patches** go in `build/phpsysinfo-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/phpsysinfo-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/phpsysinfo-s4/manifest.json`:**
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

**Also in `build/phpsysinfo-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py phpsysinfo-s4 --only static
python3 -I common/gate/gate.py phpsysinfo-s4 --only nop
python3 -I common/gate/gate.py phpsysinfo-s4 --only oracle
python3 -I common/gate/gate.py phpsysinfo-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/phpsysinfo-s4/`;
  - edit only `tasks/phpsysinfo-s4/`, `build/phpsysinfo-s4/` and, for pattern B, the register;
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
