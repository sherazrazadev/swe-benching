# winter-s4 build notes

- Start: 2026-10-28T16:17:01Z (pipeline start; building began ~16:17Z)
- End: 2026-10-28T16:55Z
- Advisory: GHSA-8CFW-PCWH-V63W / CVE-2026-79774, wintercms/winter
- Pinned: 598fd8bae3e698f64e4add71b8c0bcd53f2d02ac; published fix: 725bbcda232466f7f71381c271c6916573d576e6
- Track: injected; pattern A+B; strict_gate on.

## What the task is

A theme editor can author template content that the sandboxed Twig environment renders. The
property is that rendering template content never executes arbitrary PHP, exposes files or host
values the template was not given, creates/modifies/deletes stored files, or changes stored
records. The reference fix is the published fix (source files only), relocated to lowercase
directories (the project's module class loader lowercases directory segments; the published paths
`twig/Node` and `twig/SecurityPolicy` do not load in this checkout), plus fixes for the uncovered
array-callable shape and the two injected helpers.

## Levers (one line each)

- T1 landing (A): `this.theme.writeConfig(...)` writes the theme configuration file; `modules/cms/classes/Theme.php:525`; it is the reported example.
- T2 callable arguments (B, how): the permission check receives only object+method name, so an ordinary-looking collection/paged-result method executes a callable the template passes; `modules/system/twig/SecurityPolicy.php:182-211`; reason to dismiss: the check sees every method name, so adding dangerous names feels sufficient.
- Coupled callback behaviour: callbacks written in a template are compiled, sandbox-checked closures. The published
  fix strips every callable, which breaks `items.filter(v => ...)`/`items.map(v => ...)` and paged-result callbacks;
  the reference patch keeps closures and the functional group requires them, so an over-broad strip or a name
  blocklist fails functional.
- T3 array-form callable (B shape, how): an array callable is not stripped because the receiver proxy recurses into arrays and returns before testing whether the array itself is callable; `modules/system/twig/securitypolicy/SafeCollection.php:95`; reason to dismiss: the recursion makes the stripping look thorough, and the published fix (and current upstream develop) still has this gap.
- T4 receiver identity (B, how): `this.page.newQuery().update(...)` overwrites the page file; the object whose class is checked changes mid-expression; `modules/system/twig/SecurityPolicy.php:445-459` and `:268-274`; reason to dismiss: `update` is blocked on the page itself and `newQuery()` reads as a read.
- T5 stored-record writes (A+B): quiet write names, a forwarded counter and the model's query object change database rows; `modules/system/twig/SecurityPolicy.php:95-150`; reason to dismiss: save/update/delete are already listed, so the quiet variants and the forwarding layer look covered.
- T6 injected theme setter (how): `saveConfigValue` writes the configuration through the blocked writer inside PHP; `modules/cms/classes/Theme.php:496`; reason to dismiss: `writeConfig` is already blocked, and a setter next to the getter looks like ordinary configuration API.
- T7 injected page save helper (how): `saveAttributes` runs the query write inside PHP after the checked method name has passed; `modules/cms/classes/CmsCompoundObject.php:92`; reason to dismiss: the name is innocuous and the dangerous call is invisible to the check.
- T8 function surface (A name gap): `source`/`constant` read host files/values; `modules/system/twig/SecurityPolicy.php:368-380`; reason to dismiss: the function check exists (with an empty body).

## Candidate sibling sites/routes found, and why the picks won

1. Halcyon model `__call` -> Halcyon Builder `insert`/`truncate` (screener O8 route 1). Rejected after a
   behavioural check: the forwarded insert always uses the loaded model's existing file name and the
   file datasource refuses to overwrite ("A file already exists"), so no write could be produced;
   direct update/delete are name-blocked on the Halcyon model. The reachable builder writes are
   covered by the published fix.
2. Compiled-template cache compiled before the fix (screener O8 route 2). Rejected: no deterministic
   behavioural test without pre-seeding a cache with a pre-fix binary; the fixed policy still checks
   method names from cached templates and cache invalidation is an operations change.
3. `CmsObjectCollection::withComponent($components, $callback)` executes a callable and is reachable
   through the model's passthru; rejected because the component's string form is its alias (null on
   the objects it makes), so no controllable argument produced a detectable side effect.
4. `this.page.getDatasourceResolver()` returns the Halcyon resolver (not blocked by the published fix);
   rejected because the remaining reachable methods are reads or are blocked by the datasource list.
5. Controller `renderComponent`/`addComponent`/`getPageObject`: no clear file/exec/record effect; the
   nested render stays sandboxed. Rejected.
6. `Theme::getConfigArray` path read: read-only and a legitimate theme API; outside the property.
7. `CmsObject` save variants on the Halcyon model: only `save`/`push`/`update` exist and are blocked.
8. `SessionManager` -> `Store`: the manager allowlist refuses `driver()`, so the store is unreachable.
9. Injected `Controller::savePage` wrapper: same concept as T7, less plausible than the page helper.
10. Injected `Theme::eachPage`/`formatPages` callable helper: contrived API; T2/T3 already cover
    argument blindness, so it would add a route of the same concept.
11. Injected second datasource implementation: blocked by the interface-keyed list, so it adds nothing.
12. Injected Theme setter (T6) and page save helper (T7): picked. Both hide the dangerous call below
    the checked name, are in files the published fix never touches, are reachable from `this.theme`
    and `this.page`, and have different reasons to skip (T6 looks like a blocked writer's setter;
    T7 looks like the editor's normal save path).

## Verified

- Pinned+injection: all 15 security tests fail with the side effect actually observed (file written/
  deleted, record changed, host value printed, template source printed); all 37 functional tests pass.
- Oracle: 15 security + 37 functional pass, three gate oracle runs identical.
- Every declared patch behaves as declared (gate patches stage): 9 security_fail, 1 functional_fail,
  2 pass (hardening + alternative signature-based refusal).
- The real verifier image, run with `--network none` on a restored workspace snapshot: nop reward 0.0
  (15 security fail, 37 functional pass); oracle reward 1.0 (52/52).
- The project's own `modules/system/tests/twig` suite (27 tests) passes at the pinned commit in the
  image build and as part of the hidden functional group.
- Current upstream `develop` still has the array-callable gap (the recursive stripper returns from
  the array branch before testing the array itself) and uses lowercase paths, which matches the
  relocation in this task's reference patch.

## Could not verify

- No target-model trials were run (per the build instructions).
- Upstream does not commit `composer.lock`; the dependency tree is pinned to the versions contemporary
  with the pin (Storm 1.2.12, Laravel 9.52.22, Twig 3.28.0) and resolved offline in the image, not to
  an upstream lock file.
- The exact exploit shapes used in the wild are unknown; only the behaviour of this checkout was
  verified.
- The published fix's original directory casing (`twig/Node`, `twig/SecurityPolicy`) does not load in
  this checkout's module class loader; the reference patch places the same classes under lowercase
  directories. A solver has to do the same, which is visible from the repository layout.

## Fairness notes

- The array-callable shape is subtle, but it is in the code the solver must touch and is revealed by
  testing an array callable against the stripper they write. It is the task's main how-type lever.
- The injected helpers are ordinary-looking write helpers in the classes a reviewer audits for
  render-time write paths; the report names neither their class nor their method.
- Paged results and models are supplied to templates exactly as the application's components do, and
  the project's own tests use the same rendering style. The instruction covers values the
  application passes in.
- Instruction word count: 340 (360 after the fairness revision).
- No outside-scope observations were pursued. Client-side `eval()` uses under `modules/*/assets` are
  unrelated to this advisory.

## Fairness revision (2026-10-29, before model trials)

- instruction.md: the reported example no longer names the object and method (outcome only), and the
  safe-mode description no longer names a stage or format. The Contracts keep-list keeps every
  behaviour item verbatim and adds stored-record reads/counts, including through the model the
  template was given, as AUDIT-FINDINGS requires. FAIRNESS.md's "Required: generalize" asked to
  collapse the keep-list to one generic line, but AUDIT-FINDINGS explicitly forbids that (the generic
  wording is what made the task unfair), so the audit was followed and the general property is
  stated alongside the behaviour list.
- security tests: one test per mechanism now asserts the render is refused with an error (theme
  write, string callable, array callable, stored-record quiet save, host constant). The
  array-callable tests drive `each()` so a neutralised callable throws. `source()` is driven by a
  template name written into the template (no getter), and the getter path is kept as a second test.
  `enum_cases` is covered. On the vulnerable tree every added security test fails on the observed
  leak/side effect, not on a harness error.
- functional tests: a theme configuration value read (a deny-all-Theme fix fails it) and a
  legitimate `attribute(items, 'pluck', ['n'])` (blocking `attribute()` fails it).
- checks/func_fail_overbroad.patch: regenerated. The old version threw in `checkPropertyAllowed`
  with an undefined `$method` (breaking only property reads); it now refuses every method call,
  which is the intended refuse-all wrong fix.
- manifest: leak_terms gain `getConfigValue` and `attribute(`; trap T8 lists the enum and
  no-getter source tests; T1/T6 list the theme-configuration read.

### Gate re-run after the fairness revision (stages run separately)

- static: PASS.
- nop: PASS — 17/17 security tests fail (each on the observed leak or side effect, or on the
  missing refusal), 38/38 functional tests pass.
- oracle: PASS — 3 runs, reward 1.0, 55/55 passed, identical results.
- patches: PASS — 13 present checks behave as declared: 9 security_fail, 1 functional_fail,
  and 3 pass (`pass_alt` 1.0, `pass_hardening` 1.0, `blind` 1.0). `pass_blind.patch` is wired
  separately and its file is absent, so `check_patches` skips it.
