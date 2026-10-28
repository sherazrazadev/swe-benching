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

Project root: `/home/mara/cwe-bench`. Task: `oh-my-posh-s4`. Pattern: `A`. Track: `injected`.

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
- Advisory: ["GHSA-6XJ8-QV9J-XCJQ", "CVE-2026-73505", "GO-2026-6108"]; jandedobbeleer/oh-my-posh; template injection (CWE-1336) leading to arbitrary OS command execution (CWE-94) via the text/template func map
- Pinned (vulnerable) commit: 7ec9fb8eb0f091354795eca7b024332a59e6614f. Published fix: 88ddbe0b0a4dd13cc345996108c9869493f2c690.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "16287",
 "advisory_ids": [
  "GHSA-6XJ8-QV9J-XCJQ",
  "CVE-2026-73505",
  "GO-2026-6108"
 ],
 "repo": "jandedobbeleer/oh-my-posh",
 "pinned_commit": "7ec9fb8eb0f091354795eca7b024332a59e6614f",
 "fix_commits": [
  "88ddbe0b0a4dd13cc345996108c9869493f2c690"
 ],
 "trust_decision": {
  "summary": "Whether a template string may execute OS-touching functions is decided by whichever code calls template.Render: the renderer trusts every string it is given and binds the single shared func map (cmd/readFile/stat/glob/env/expandenv), so the real decision is 'is this text user-authored config?' and path.setStyle answers it wrongly for a string composed from raw filesystem folder names.",
  "evidence": [
   "src/template/func_map.go:12-51",
   "src/template/func_map.go:28-30",
   "src/template/render.go:95",
   "src/template/cmd.go:5-8",
   "src/template/files.go:11-32",
   "src/segments/path.go:185",
   "src/segments/path.go:242-288",
   "src/segments/path.go:285"
  ]
 },
 "landing_point": {
  "where": "src/segments/path.go:285",
  "why": "The advisory names the path segment; this is the only place where text built from filesystem folder names (pt.Path, filled at src/segments/path.go:251-282 from pt.root/pt.relative, which come from pt.env.Pwd() at src/segments/path.go:185-196) is fed back into template.Render with the full func map, so a directory named after a template expression executes cmd."
 },
 "fix_sites": [
  {
   "where": "src/segments/path.go:285",
   "entry_point": "oh-my-posh print primary/preview (also debug, serve, stream, statusline, config export data|image)",
   "module_kind": "segment writer (only site switched to RenderUntrusted)"
  },
  {
   "where": "src/segments/path.go:296",
   "entry_point": "same prompt renders; max_width option",
   "module_kind": "segment writer"
  },
  {
   "where": "src/segments/path.go:323",
   "entry_point": "same prompt renders; folder_separator_template option",
   "module_kind": "segment writer"
  },
  {
   "where": "src/segments/path.go:655",
   "entry_point": "same prompt renders; mapped_locations keys",
   "module_kind": "segment writer"
  },
  {
   "where": "src/config/segment.go:30",
   "entry_point": "oh-my-posh print primary (segment style resolve)",
   "module_kind": "config"
  },
  {
   "where": "src/config/segment.go:304",
   "entry_point": "oh-my-posh print primary (fallback_template)",
   "module_kind": "config"
  },
  {
   "where": "src/config/segment.go:583",
   "entry_point": "oh-my-posh print primary (segment template)",
   "module_kind": "config"
  },
  {
   "where": "src/config/config.go:101",
   "entry_point": "prompt engine setup (palettes.template)",
   "module_kind": "config"
  },
  {
   "where": "src/prompt/engine.go:120",
   "entry_point": "oh-my-posh print primary (pwd)",
   "module_kind": "prompt engine"
  },
  {
   "where": "src/prompt/engine.go:184",
   "entry_point": "oh-my-posh print primary (block filler)",
   "module_kind": "prompt engine"
  },
  {
   "where": "src/prompt/engine.go:205",
   "entry_point": "oh-my-posh print primary / debug (console_title_template)",
   "module_kind": "prompt engine"
  },
  {
   "where": "src/prompt/extra.go:60",
   "entry_point": "oh-my-posh print transient|secondary|valid|error|debug",
   "module_kind": "prompt engine"
  },
  {
   "where": "src/prompt/extra.go:195",
   "entry_point": "oh-my-posh print <type> (right/transient-right template)",
   "module_kind": "prompt engine"
  },
  {
   "where": "src/color/colors.go:163",
   "entry_point": "public API color.Ansi.ResolveTemplate, called from config/terminal colour resolution",
   "module_kind": "color"
  },
  {
   "where": "src/color/palette.go:40",
   "entry_point": "public API color.Palette.resolveColor via palette lookup",
   "module_kind": "color"
  },
  {
   "where": "src/segments/http.go:35",
   "entry_point": "oh-my-posh print primary (http segment url option)",
   "module_kind": "segment"
  },
  {
   "where": "src/segments/language.go:361",
   "entry_point": "oh-my-posh print primary (version_url_template)",
   "module_kind": "segment"
  },
  {
   "where": "src/segments/options/map.go:108",
   "entry_point": "public API options.Map.Template, used by segment option values",
   "module_kind": "segments/options"
  },
  {
   "where": "src/segments/scm.go:166",
   "entry_point": "oh-my-posh print primary (branch_template)",
   "module_kind": "segment"
  },
  {
   "where": "src/segments/status.go:51",
   "entry_point": "oh-my-posh print primary (status template)",
   "module_kind": "segment"
  },
  {
   "where": "src/segments/status.go:90",
   "entry_point": "oh-my-posh print primary (status template per pipestatus)",
   "module_kind": "segment"
  },
  {
   "where": "src/template/list.go:45",
   "entry_point": "public API template.List.Join used for template lists",
   "module_kind": "template core"
  },
  {
   "where": "src/template/list.go:62",
   "entry_point": "public API template.List.FirstMatch used for template lists",
   "module_kind": "template core"
  },
  {
   "where": "src/template/func_map.go:11-56",
   "entry_point": "public API template.Render (func map construction split into base/shared)",
   "module_kind": "template core"
  },
  {
   "where": "src/template/render.go:55-103",
   "entry_point": "public API template.Render (parse cache key gains a trust bit)",
   "module_kind": "template core"
  },
  {
   "where": "src/template/text.go:13-55",
   "entry_point": "public API template.RenderTrusted / RenderUntrusted (Text.trusted field, pool reset)",
   "module_kind": "template core"
  }
 ],
 "O1_entry_points": 6,
 "O2_out_of_scope_site": {
  "kind": "lower_level_api",
  "where": "src/template/func_map.go:11-56; src/template/render.go:55-103"
 },
 "O3_reason_to_dismiss": "The shared template package is generic plumbing with twenty trusted callers, so a solver can argue the bug is the Path segment's misuse of Render rather than the renderer's func map (and its cache key), and fix only the caller.",
 "O4_distance": {
  "files": 16,
  "packages": 6,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Config-authored template values that end up inside pt.Path must keep resolving through the setStyle re-render: mapped_locations values are spliced into root/relative unrendered (pt.mappedLocations[key] at src/segments/path.go:738 and :762-777) and only get executed by the render at :285, and a folder name that literally contains '{{ cmd `whoami` }}' must still be printed verbatim rather than stripped or escaped away (fix.diff:238). A fix that drops the re-render or blanket-escapes braces in pt.Path breaks the first, and one that deletes template markers from folder names breaks the second.",
  "where": "src/segments/path.go:285"
 },
 "O6_input_shapes": [
  "config-authored template string rendered with a nil context (src/template/list.go:45, src/prompt/engine.go:120)",
  "config-authored template string rendered with a struct/map writer context (src/config/segment.go:583)",
  "runtime-composed string: raw filesystem folder names spliced together with already-rendered config output (src/segments/path.go:285)",
  "Windows drive-letter roots and backslash separators vs Unix home-relative paths",
  "all path display styles (full, folder, agnoster*, mixed, letter, unique, powerlevel, fish) funnelling through the same re-render",
  "literal '{{' '}}' in a folder name that must survive unexecuted (fix.diff:238)",
  "identical template text rendered under both trust levels, and pooled *Text instances reused between renders"
 ],
 "O7_producer": {
  "kind": "cache",
  "where": "src/template/render.go:81-103",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "src/segments/scm.go:161-171",
   "sibling": "render the substituted branch text (mapped_branches value) as a template, not just the config branch_template",
   "why_realistic": "branch names arrive from repository metadata; a maintainer wanting to theme 'feature/xyz' would re-render the composed branch text exactly as setStyle re-renders pt.Path."
  },
  {
   "where": "src/segments/language.go:355-366",
   "sibling": "format l.Version into version_url_template before rendering it",
   "why_realistic": "the version is parsed from tool output, and building the URL by interpolating the version into the template string is the natural next refactor in buildVersionURL."
  },
  {
   "where": "src/segments/http.go:33-38",
   "sibling": "a second render of the already-resolved url option",
   "why_realistic": "the segment resolves the url and then uses it; a 'resolve templates twice in case the first pass produced more' helper is the same shape as setStyle."
  },
  {
   "where": "src/segments/options/map.go:102-116",
   "sibling": "options.Map.Template called on an option populated at runtime (refreshed access token, cached API value)",
   "why_realistic": "the helper renders any option value with the full func map and documents that as its purpose; nothing distinguishes a config-authored value from one a segment filled in."
  },
  {
   "where": "src/template/render.go:55-75",
   "sibling": "RenderUntrusted that shares a cached parse with the full func map because the key has no trust bit",
   "why_realistic": "the guard then silently fails whenever the same text was first rendered trusted; the published fix had to change precisely this key."
  },
  {
   "where": "src/template/text.go:19-30",
   "sibling": "pooled Text reused across trust levels leaving a stale trusted flag",
   "why_realistic": "the pool hands objects between renders, so forgetting to reset the flag in release() flips a later untrusted render back to the full func map."
  }
 ],
 "O9_family": "template injection (CWE-1336) leading to arbitrary OS command execution (CWE-94) via the text/template func map",
 "O9_dos": false,
 "O10_build": {
  "language": "Go",
  "toolchain": "go 1.26.0 (src/go.mod:3), module github.com/jandedobbeleer/oh-my-posh/src, no vendor directory",
  "services": [],
  "offline_after_build": true,
  "project_tests": "table-driven tests in src/segments/path_test.go, src/segments/path_unix_test.go and src/segments/path_windows_test.go using a mock environment, plus src/template/*_test.go (text, render/pool, cmd, files, list, link, numbers, strings, locale); the published fix extends the path tables and switches their helpers to RenderTrusted. None of these need network."
 },
 "O11_fix_minutes": 40,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/color/colors.go, src/color/palette.go, src/config/config.go, src/config/segment.go, src/prompt/engine.go, src/prompt/extra.go, src/segments/http.go, src/segments/language.go, src/segments/options/map.go, src/segments/path.go, src/segments/scm.go, src/segments/status.go, src/template/func_map.go, src/template/list.go, src/template/render.go, src/template/text.go",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Escape or strip template markers from the folder names before setStyle re-renders them (following the existing chevron escape at src/segments/path.go:702-705), leaving Render's full func map reachable from every other text composer."
 },
 "out_of_scope_notes": [],
 "unverified": [
  "repo_mb: no shell/du was available (reading and searching only), so repository size was not measured.",
  "Only the one-line advisory summary was supplied; the full GHSA/CVE text was not read, so the advisory's own wording of the protected property is inferred from the summary and the fix diff.",
  "The claim that a trust-blind parse cache defeats a naive RenderUntrusted guard is reasoned from src/template/render.go:55-103; it was not executed.",
  "No build or test run was performed (reading only); toolchain and module-cache availability offline is assumed from src/go.mod and the absence of a vendor directory."
 ]
}
  ```
- Published fix sites:   - src/segments/path.go:285 — entry point: oh-my-posh print primary/preview (also debug, serve, stream, statusline, config export data|image) [segment writer (only site switched to RenderUntrusted)]
  - src/segments/path.go:296 — entry point: same prompt renders; max_width option [segment writer]
  - src/segments/path.go:323 — entry point: same prompt renders; folder_separator_template option [segment writer]
  - src/segments/path.go:655 — entry point: same prompt renders; mapped_locations keys [segment writer]
  - src/config/segment.go:30 — entry point: oh-my-posh print primary (segment style resolve) [config]
  - src/config/segment.go:304 — entry point: oh-my-posh print primary (fallback_template) [config]
  - src/config/segment.go:583 — entry point: oh-my-posh print primary (segment template) [config]
  - src/config/config.go:101 — entry point: prompt engine setup (palettes.template) [config]
  - src/prompt/engine.go:120 — entry point: oh-my-posh print primary (pwd) [prompt engine]
  - src/prompt/engine.go:184 — entry point: oh-my-posh print primary (block filler) [prompt engine]
  - src/prompt/engine.go:205 — entry point: oh-my-posh print primary / debug (console_title_template) [prompt engine]
  - src/prompt/extra.go:60 — entry point: oh-my-posh print transient|secondary|valid|error|debug [prompt engine]
  - src/prompt/extra.go:195 — entry point: oh-my-posh print <type> (right/transient-right template) [prompt engine]
  - src/color/colors.go:163 — entry point: public API color.Ansi.ResolveTemplate, called from config/terminal colour resolution [color]
  - src/color/palette.go:40 — entry point: public API color.Palette.resolveColor via palette lookup [color]
  - src/segments/http.go:35 — entry point: oh-my-posh print primary (http segment url option) [segment]
  - src/segments/language.go:361 — entry point: oh-my-posh print primary (version_url_template) [segment]
  - src/segments/options/map.go:108 — entry point: public API options.Map.Template, used by segment option values [segments/options]
  - src/segments/scm.go:166 — entry point: oh-my-posh print primary (branch_template) [segment]
  - src/segments/status.go:51 — entry point: oh-my-posh print primary (status template) [segment]
  - src/segments/status.go:90 — entry point: oh-my-posh print primary (status template per pipestatus) [segment]
  - src/template/list.go:45 — entry point: public API template.List.Join used for template lists [template core]
  - src/template/list.go:62 — entry point: public API template.List.FirstMatch used for template lists [template core]
  - src/template/func_map.go:11-56 — entry point: public API template.Render (func map construction split into base/shared) [template core]
  - src/template/render.go:55-103 — entry point: public API template.Render (parse cache key gains a trust bit) [template core]
  - src/template/text.go:13-55 — entry point: public API template.RenderTrusted / RenderUntrusted (Text.trusted field, pool reset) [template core]
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

## Environment (`tasks/oh-my-posh-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/oh-my-posh-s4/instruction.md`)
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

## Tests (`tasks/oh-my-posh-s4/tests/`)
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
- **Wrong-fix patches** go in `build/oh-my-posh-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/oh-my-posh-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/oh-my-posh-s4/manifest.json`:**
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

**Also in `build/oh-my-posh-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py oh-my-posh-s4 --only static
python3 -I common/gate/gate.py oh-my-posh-s4 --only nop
python3 -I common/gate/gate.py oh-my-posh-s4 --only oracle
python3 -I common/gate/gate.py oh-my-posh-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/oh-my-posh-s4/`;
  - edit only `tasks/oh-my-posh-s4/`, `build/oh-my-posh-s4/` and, for pattern B, the register;
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
