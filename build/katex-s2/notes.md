# katex-s2 — build notes

## Window
- start: 2026-10-28T00:06:20Z (build job start)
- end: 2026-10-28T00:35:55Z (hand-off; the pipeline re-gates after the build)

## What the task is
KaTeX (TypeScript, pinned 5a5bf206, the direct parent of the published fix 0adf7e77 "prevent
prototype pollution in settings"). A value placed on JavaScript's shared object prototype must not
decide what KaTeX renders, what it trusts, or which macro names exist. Track: injected; pattern A+B.
Two properties: (1) what is rendered and what is permitted come only from the caller's own option
entries and KaTeX's own defaults, and a value that exists only on the shared prototype never makes
input trusted and never changes the rendered result; (2) a name is a definition only when KaTeX or
the current render defines it.

## Levers (one line each)
- T1_settings_options (A, reported): the caller's own options entry only — src/Settings.ts:350.
  Dismiss: none (reported).
- T2_schema_metadata (A, far site / producer off the check's path): the schema entry's own
  default/processor only — src/Settings.ts:337,352-353. Dismiss: the schema is a module constant,
  so the read looks like static bookkeeping.
- T3_trust_context (B, protection never existed): the protocol/url handed to the trust function
  must be the command's own — src/Settings.ts:482. Dismiss: it is the check itself and already
  derives the protocol; the reported shape is a polluted setting.
- T4_macro_namespace (A, far site in a second module): macro names resolve only from own
  properties — src/Namespace.ts:85. Dismiss: the class already own-checks the per-render map, so
  the builtin fallback looks guarded.
- T5_namespace_undo (A, same module, write side): the undo capture must not record an inherited
  value — src/Namespace.ts:114. Dismiss: it reads as undo bookkeeping and is masked until the
  lookup is own-property-only.
- T7_auto_render (B, another package entry): auto-render resolves its own options only —
  contrib/auto-render/auto-render.ts:130-151. Dismiss: a separate package entry that only picks
  macros and delimiters, outside the settings path.
- T8_option_value_forms (coupled must-keep-working): function/string/map-valued options, an own
  `undefined` fallback, a Settings instance as options and the caller's mutable macro table —
  src/Settings.ts:340-353,384-405. Dismiss: the natural Boolean/hasOwnProperty-only hardening
  breaks the documented forms the project suite relies on.
- S1_trust_map (injected, how-type, producer off the check's path): the `trust` option also accepts
  a protocol map; the constructor normalises it to the function the check calls, and that lookup
  reads the prototype — src/Settings.ts:396-401. Dismiss: the caller's own map, and the check
  itself only sees a function.
- S2_html_attr (injected, second trust path / shape): an added HTML attribute command lets a static
  allowlist of annotation-only attributes skip trust, and the allowlist is consulted through the
  prototype — src/functions/html.ts:12,110. Dismiss: a static table of known-safe names.

## Injected siblings: candidate list and why the picks won
Screener O8/O8b leads plus a search of the pinned tree:
1. `src/MacroExpander.ts` catcode read (real): a one-character active name could be suppressed, but
   the macro lookup already returns before it; it can only change expansion of an existing macro,
   not create one. Not built.
2. `cli.js:26-30` schema metadata reads (real): needs a built dist and a preloaded polluter to reach
   the CLI; a short-lived CLI process is a poor threat surface. Not built.
3. `contrib/auto-render` option resolution (real) — used as T7.
4. `src/functions/html.ts` one more attribute command with its own trust helper (O8b #1) — used as
   S2; the allowlist is a static table and the command is a natural extension of the existing
   handler.
5. A second `Namespace` for counters/registers (O8b #2) — rejected: KaTeX has no counters today, a
   whole new feature is needed to make it reachable, and a second `Namespace` would be closed by
   the same upstream fix, so it adds no independent lever.
6. A new merged option in auto-render (O8b #3) — rejected: more routes of the T7 concept.
7. Symbol/font-metric/unit tables keyed by attacker text (`src/buildCommon.ts`, `src/buildMathML.ts`,
   `src/fontMetrics.ts`, `src/units.ts`, `src/macros.ts`) — real plain reads, but they change layout
   or glyph selection, not a security decision, and are outside this advisory's settings/macro-name
   protection. Noted, not built.
8. `functions[func]` in `src/Parser.ts` (real) — a polluted command name is treated as a function
   but needs a function-valued definition to do anything other than throw; DoS, not the protected
   outcome. Not built.
The two picked (S1, S2) are the hardest of the candidates that stay inside the advisory's
protection and are covered by the one general property; they sit in different modules from each
other and from every published-fix hunk, and neither is described anywhere in the instruction.

## What I verified
- The published fix (0adf7e77) is four source hunks: `src/Settings.ts` (schema default, options and
  processor reads) and `src/Namespace.ts` (get, set). It does not touch `isTrusted` or auto-render.
- The pinned tree contains no regression test for the fix (the only one lands in 0adf7e77).
- The injection applies to the pinned tree; `tsc --noEmit` and the project's own
  `test/katex-spec.ts` (623 tests, 22 snapshots) pass at pinned+injected and on the oracle.
- Local matrix (node 22.23.4, jest 30.2, babel-jest, jsdom via jest-environment-jsdom):
  - pinned+injected: security 0/22, functional 658/658.
  - oracle: security 22/22, functional 658/658.
  - miss_settings_options 4 security fail; miss_schema_metadata 3; miss_trust_context 3;
    miss_macro_namespace 3; miss_auto_render 2; miss_trust_map 4; miss_html_attr 3;
    sf-get-only 1; sf-href-only 2 (functional 0); all with functional 658/658.
  - sf-wrong-object 1 functional fail; ff-overcoerce 7 security + 103 functional fail;
    ff-refuse-trusted 32 functional fail.
  - upstream_fix exactly as shipped: 12 security fail (T3 3, T7 2, S1 4, S2 3), functional
    658/658 — the task adds beyond upstream.
  - pass-hardening and pass-alt: security 22/22, functional 658/658.
- The injected routes reproduce behaviourally through the real entry points on the pinned copy: a
  polluted protocol key in the trust map grants a `javascript:` link, and a polluted event-handler
  name in the allowlist is emitted as an attribute.
- The injection is in the agent image only. The verifier overlays the submitted tree on the
  pristine pinned sources, so the injected files arrive with the submission; deleting the feature
  makes the coupled functional tests fail.

## What I could not verify
- Target-model trials (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) are run downstream, not here.
- `present_in_latest` for the two injected siblings is "no" by construction (our copy only); for T3
  and T7 the current `origin/main` still has the same code (read-only look).
- Whether an attacker-reachable pollution primitive exists inside KaTeX itself was not
  investigated; the advisory assumes pollution supplied by another library.
- The package's browser-build and screenshot suites are not run (they need a built dist, a browser
  and network).

## Fairness notes
- The coupled values (function/string/map-valued options, own-undefined fallback, settings
  instances, the caller's mutable macro table, HTML-command contexts without a URL, the safe
  attribute allowlist) are product behaviour and are tested functionally; the report covers them by
  "everything that works today keeps working exactly as today" and one value-form sentence.
- A fix placed at any valid layer passes: own-property reads, descriptor reads, a fresh context, a
  prototype-free option copy, a Map/Set rebuild (pass-alt), and the oracle's layer.
- Every tested route is reachable through the two public entry points named in the task; no route
  needs network, a GPU or a GUI.

## Gate status at hand-off (2026-10-28)
- static: PASS, no warnings (manifest has all 16 patch entries, catalogue complete, no leaks).
- nop: PASS in-container: security 0/22 (every security test fails on the injected tree),
  functional 658/658.
- oracle: PASS, 3 runs, reward 1.0, identical results (security 22/22 + functional 658/658).
- patches: PASS, 15/15 declared outcomes in-container: 10 security_fail (misses for every lever plus
  sf-get-only, sf-href-only and upstream_fix), 3 functional_fail (sf-wrong-object, ff-overcoerce,
  ff-refuse-trusted), and pass-hardening / pass-alt at reward 1.0. The published fix alone
  (upstream_fix.patch) scores 0.4545 with 12 security tests failing.
- The blind patch and FAIRNESS.md are written downstream by the pipeline, as the build prompt says.

## Pattern B register
Four rows appended to build/audit/uncovered-routes.tsv: T3 and T7 (real upstream, present in
latest) and S1 and S2 (injected, our copy only).
