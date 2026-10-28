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

Project root: `/home/mara/cwe-bench`. Task: `sveltia-cms-s4`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-H5JC-78HR-3PC9"]; sveltia/sveltia-cms; cross-site scripting via unsanitized preview HTML (CWE-79)
- Pinned (vulnerable) commit: 871909f8bbe0c14bbfab3f60acf681d2dc19fab0. Published fix: 8c46294eadf52a8ac48740ccb5054b99d65cff1b.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "11685",
 "advisory_ids": [
  "GHSA-H5JC-78HR-3PC9"
 ],
 "repo": "sveltia/sveltia-cms",
 "pinned_commit": "871909f8bbe0c14bbfab3f60acf681d2dc19fab0",
 "fix_commits": [
  "8c46294eadf52a8ac48740ccb5054b99d65cff1b"
 ],
 "trust_decision": {
  "summary": "The RichText/Markdown preview decides trust at rich-text-preview.svelte:218 with DOMPurify `sanitize(rawHTML, SANITIZE_OPTIONS)`, and SANITIZE_OPTIONS (helper.js:21-25) permits `<iframe>` while constraining neither its `src` scheme/origin nor its `sandbox`, so any iframe markup committed with the entry (e.g. a relative same-origin path) reaches the `{@html}` sink at line 239 unsandboxed; the published fix moves the decision into a service helper that post-processes iframes (validateIframe + sanitizeRichTextHTML, fix.diff:82-147).",
  "evidence": [
   "src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:218",
   "src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:239",
   "src/lib/services/contents/fields/rich-text/helper.js:21-25",
   "src/lib/services/contents/fields/rich-text/helper.js:23",
   "fix.diff:69-74",
   "fix.diff:82-121",
   "fix.diff:130-147"
  ]
 },
 "landing_point": {
  "where": "src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:218",
  "why": "It is the only call that turns markdown into HTML for the `{@html}` sink at line 239, and the advisory summary names the Markdown/RichText preview, which is exactly this component (widgets `richtext` and alias `markdown`, see src/lib/components/contents/details/fields/index.js:79,83)."
 },
 "fix_sites": [
  {
   "where": "src/lib/services/contents/fields/rich-text/helper.js:21-25",
   "entry_point": "RichText/Markdown field preview in the entry editor (component rich-text-preview.svelte), reached for widgets `richtext` and alias `markdown` via src/lib/components/contents/details/preview/field-preview.svelte:94",
   "module_kind": "service/helper module (plain JS, exported consts and functions)"
  },
  {
   "where": "src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:218",
   "entry_point": "RichText/Markdown field preview in the entry editor (same single entry point; the component's per-markdown-block parser callback)",
   "module_kind": "Svelte 5 component (UI preview)"
  }
 ],
 "O1_entry_points": 1,
 "O2_out_of_scope_site": {
  "kind": "none",
  "where": ""
 },
 "O3_reason_to_dismiss": "`sanitize_preview: false` is a documented per-field/`field_defaults.richtext` opt-out for admins who fully trust every CMS user (src/lib/types/public.js:757-760), so the unsanitized branch at rich-text-preview.svelte:218 predates and is outside the advisory's sanitizer hardening.",
 "O4_distance": {
  "files": 1,
  "packages": 0,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Legitimate cross-origin HTTPS media embeds (YouTube/Vimeo and generic https embeds) must keep rendering in the rich-text preview with their `allow`, `allowfullscreen` and `referrerpolicy` attributes intact, and `blob:` image srcs must keep working for local upload previews; dropping `iframe` from ADD_TAGS or tightening ALLOWED_URI_REGEXP passes the advisory's example but kills all of these.",
  "where": "src/lib/services/contents/fields/rich-text/helper.js:14-25 (blob: for local image previews, iframe for embedded media); fix.diff:293-346 (the fix's own tests require https embeds and allow/allowfullscreen/referrerpolicy to survive)"
 },
 "O6_input_shapes": [
  "iframe src scheme variants: javascript:, data:, blob:, file:, vbscript:, http:, about:blank, and mixed/upper-case spellings (fix.diff:176-217, 358-403)",
  "relative and protocol-relative paths: leading `/`, `//host/...`, `./x`, `../x`, backslash form, whitespace-padded (fix.diff:219-267, 405-417)",
  "missing, empty or whitespace-only src (fix.diff:248-267)",
  "absolute HTTPS URL whose origin equals window.location.origin (fix.diff:269-284)",
  "malformed URLs that make `new URL()` throw (fix.diff:419-445)",
  "pre-existing `sandbox` attribute: author tokens such as allow-popups must be merged with, not replaced by, the two enforced tokens; duplicate `sandbox` attributes (fix.diff:302-321, 447-455)",
  "several iframes in one markdown block, only the safe one surviving (fix.diff:365-385)"
 ],
 "O7_producer": {
  "kind": "handler",
  "where": "src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:215-218 (marked `parse(block, { breaks: true })` produces the HTML that is handed straight to the sanitizer on the next line; the markdown string itself is assembled by buildMarkdownWithPreviews at src/lib/services/contents/fields/rich-text/helper.js:212-264, which splices component `toPreview()` HTML from src/lib/services/contents/fields/rich-text/components/definitions.js:41-46,76-83)",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [
  {
   "route": "RichText preview with sanitization opted out (`sanitize_preview: false` per field or via `field_defaults.richtext`): the same marked output goes straight to `{@html}` at line 239, so the same unsandboxed same-origin iframe still reaches the sink and the fix changes nothing on this branch.",
   "where": "src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:89,218,239",
   "reason_to_dismiss": "The option is documented as an intentional opt-out for trusted user bases (src/lib/types/public.js:757-760), so a solver can argue the unsanitized branch was never covered by the advisory's sanitizer fix.",
   "distance": "same file and same function as the landing point (0 files, 0 packages)",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "src/lib/components/assets/details/asset-details-overlay.svelte:74-78",
   "sibling": "Markdown file preview that renders a repository `.md` asset through marked into `{@html sanitize(rawHTML)}`; a maintainer who wanted embeds in file previews would copy SANITIZE_OPTIONS there.",
   "why_realistic": "Identical marked+DOMPurify pattern over content a repository writer controls, four directories away from the fixed site and currently relying on bare DOMPurify defaults to strip iframes."
  },
  {
   "where": "src/lib/services/contents/fields/rich-text/components/definitions.js:41-46",
   "sibling": "A `toPreview()` that emits an iframe (or an embed component added alongside `image`/`linked-image`) would produce HTML spliced into the markdown before parsing, so it would need the same validateIframe treatment.",
   "why_realistic": "toPreview already returns raw HTML strings that are concatenated into the markdown string (helper.js:247-259), and editor components are a documented extensibility point (`CMS.registerEditorComponent`)."
  },
  {
   "where": "src/lib/components/contents/details/fields/string/youtube-embed.svelte:47-55",
   "sibling": "The string field's YouTube embed iframe, hard-coded to a vetted URL with `sandbox=\"allow-same-origin allow-scripts\"`; a URL-driven embed variant for other providers would need validateIframe.",
   "why_realistic": "The pinned commit itself is 'Add sandbox attributes to embedded iframes' (871909f8), i.e. the maintainers were hardening this neighbouring iframe at the same time; extending embed support to arbitrary providers is the natural next change."
  }
 ],
 "O9_family": "cross-site scripting via unsanitized preview HTML (CWE-79)",
 "O9_dos": false,
 "O10_build": {
  "language": "JavaScript (ESM, JSDoc types) + Svelte 5 components",
  "toolchain": "pnpm, Node 25 (.nvmrc), Vite 8 + @sveltejs/vite-plugin-svelte, Vitest 4 (test env default node; isomorphic-dompurify brings jsdom for DOMPurify)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "`pnpm test` = `vitest run` (package.json:41); the affected area's tests are src/lib/services/contents/fields/rich-text/helper.test.js \u2014 at the pinned commit it contains no sanitize/iframe tests, the fix appends a `SANITIZE_OPTIONS iframe security (XSS prevention)` describe block (fix.diff:154-456)."
 },
 "O11_fix_minutes": 40,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/lib/services/contents/fields/rich-text/helper.js, src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 0,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Delete 'iframe' from ADD_TAGS in SANITIZE_OPTIONS (or narrow ALLOWED_URI_REGEXP), which removes the reported payload but also removes every legitimate YouTube/Vimeo embed and breaks blob: image previews."
 },
 "out_of_scope_notes": [
  "src/lib/components/assets/details/asset-details-overlay.svelte:77 renders repository `.md` assets with marked + bare DOMPurify (iframes already stripped) \u2014 a different sink from this advisory, not pursued.",
  "src/lib/services/contents/entry/summary.js:66 sanitizes entry summaries with a three-tag allowlist; unrelated to this advisory.",
  "The pinned commit's own subject is 'Add sandbox attributes to embedded iframes' (the string-field YouTube embed at src/lib/components/contents/details/fields/string/youtube-embed.svelte:54); that belongs to the sibling advisory, not screened here.",
  "src/lib/components/contents/details/preview/entry-preview-iframe.svelte:98 mounts the whole preview document in a same-origin blob iframe with sandbox=\"allow-same-origin allow-scripts\"; noted as a wrapper, not a route into this advisory's sink."
 ],
 "unverified": [
  "repo_mb: repository size could not be measured without a shell, so the `tiny_repo` (<5 MB of source) red flag was not asserted either way.",
  "No advisory body was supplied beyond the one-line summary, so the published report's exact wording and its 'must keep working' requirement are unknown.",
  "present_in_latest for the O8 route is unknown: no latest release or latest code was provided.",
  "Whether the hidden tests can drive the Svelte preview component at all; the changed helper is unit-testable in Node/jsdom, but the advisory names a UI preview.",
  "Whether requiring the `sanitize_preview: false` branch to be hardened is fair: it is a documented opt-out (src/lib/types/public.js:757-760), which also means `protection_documented_without_exceptions` does not hold."
 ]
}
  ```
- Published fix sites:   - src/lib/services/contents/fields/rich-text/helper.js:21-25 — entry point: RichText/Markdown field preview in the entry editor (component rich-text-preview.svelte), reached for widgets `richtext` and alias `markdown` via src/lib/components/contents/details/preview/field-preview.svelte:94 [service/helper module (plain JS, exported consts and functions)]
  - src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:218 — entry point: RichText/Markdown field preview in the entry editor (same single entry point; the component's per-markdown-block parser callback) [Svelte 5 component (UI preview)]
- Uncovered routes to confirm (pattern B):   - src/lib/components/contents/details/fields/rich-text/rich-text-preview.svelte:89,218,239 — RichText preview with sanitization opted out (`sanitize_preview: false` per field or via `field_defaults.richtext`): the same marked output goes straight to `{@html}` at line 239, so the same unsandboxed same-origin iframe still reaches the sink and the fix changes nothing on this branch. (reason to dismiss: The option is documented as an intentional opt-out for trusted user bases (src/lib/types/public.js:757-760), so a solver can argue the unsanitized branch was never covered by the advisory's sanitizer fix.; still in latest: unknown)
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

## Environment (`tasks/sveltia-cms-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/sveltia-cms-s4/instruction.md`)
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

## Tests (`tasks/sveltia-cms-s4/tests/`)
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
- **Wrong-fix patches** go in `build/sveltia-cms-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/sveltia-cms-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/sveltia-cms-s4/manifest.json`:**
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

**Also in `build/sveltia-cms-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py sveltia-cms-s4 --only static
python3 -I common/gate/gate.py sveltia-cms-s4 --only nop
python3 -I common/gate/gate.py sveltia-cms-s4 --only oracle
python3 -I common/gate/gate.py sveltia-cms-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/sveltia-cms-s4/`;
  - edit only `tasks/sveltia-cms-s4/`, `build/sveltia-cms-s4/` and, for pattern B, the register;
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
