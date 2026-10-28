# katex-s2 — build notes (build-v1, pattern A+B, track injected)

## Window
- start: 2026-10-27T22:23:39Z (job start; `start_utc.txt`)
- end: 2026-10-27T22:56:31Z (gate stages complete; hand-off)

## Candidate
KaTeX (TypeScript, library + contrib entries), pinned `5a5bf2060431aaed5eb3b549f6fab24f55e9e70a`,
published fix `0adf7e77db6915d991803b29699f82b1ccf8d4f4` (source hunks: own-property reads in
`src/Settings.ts` and `src/Namespace.ts`, plus its regression test).

## What the task is
A page hands KaTeX LaTeX and render options. A value planted on JavaScript's shared object
prototype must never decide what a render emits or permits. One property, stated once in the
report: only the caller's own entries and KaTeX's own definitions may decide a render; a value
that exists only on the shared prototype may never change what is emitted, which commands are
permitted, or the data a permission decision is shown — however it reaches the decision.

## Design (written before building)
Main lever is **how-type**: T3_trust_context, a route where the prototype-safety protection never
existed (the trust check's own URL/protocol handling) and where a plausible own-property guard
still mishandles a context that carries no URL. Second how-type lever is the injected S2
(an options wrapper re-materialises an inherited value as an own option, so the renderer's
own-property fix cannot see the origin). The rest are supporting sites.

### Security property (one, general, over the protected outcome)
"Only the caller's own entries and the renderer's own definitions may decide a render. A value
that exists only on JavaScript's shared object prototype must never change what a render emits,
which commands it permits, or the data on which that permission decision is made, however the
value reaches it." Read literally it covers: options own-read, schema-default/adjuster own-read,
macro namespace, trust-context own data, auto-render option resolution, and both injected
siblings. The report names no route.

### Levers (one line each)
- T1_settings_options (advisory landing, both models): the caller's own option entry only —
  `src/Settings.ts:342` (`applySetting`); reason to dismiss: none (reported).
- T2_schema_metadata (A far site, deepseek): the schema entry's own `default`/`processor` only —
  `src/Settings.ts:329-331,344-345`; reason to dismiss: `SETTINGS_SCHEMA` is a module constant,
  so the reads look like static bookkeeping; the published fix changes it too.
- T3_trust_context (**MAIN, how-type**, both): the permission decision may see only the request's
  own data — `src/Settings.ts:464-476`; reason to dismiss: it is the check itself and already
  derives the protocol; the report's shape is a polluted setting. Real, unmodified upstream code
  the published fix never touches.
- T4_macro_namespace (A far site, second module, deepseek): macro names resolve only from own
  entries — `src/Namespace.ts:81-87`; reason to dismiss: the class already calls hasOwnProperty
  on the per-render map, so the builtin fallback looks guarded.
- T5_namespace_undo (A far site, same module, write side, deepseek): the undo capture must not
  record an inherited value — `src/Namespace.ts:112-115`; reason to dismiss: it reads as undo
  bookkeeping and is masked until the lookup is own-only.
- T7_auto_render (B uncovered route, deepseek): auto-render resolves its own options only —
  `contrib/auto-render/auto-render.ts:130-161`; reason to dismiss: a convenience entry that only
  picks macros and delimiters, outside the settings path.
- S1_html_attribute_policy (**injected**, both): an internal inert-attribute exemption is
  consulted as an authority before the trust check — `src/functions/html.ts` (injected); reason
  to dismiss: it reads as markup policy for a new command, and the central trust call is right
  next to it; the published fix never touches the file.
- S2_auto_render_trust_default (**injected, how-type**, both): the wrapper copies its default
  onto the options object, so an inherited value becomes an own value and defeats the renderer's
  own-property fix — `contrib/auto-render/auto-render.ts` (injected); reason to dismiss: the
  renderer is already fixed and this looks like ordinary default forwarding.
- T8_option_value_forms (coupled must-keep-working, mimo): function-valued trust/strict, own
  undefined falling back to the default, a settings instance as options, and a caller macro table
  must keep working while reads become own-only; the natural Boolean coercion breaks them.

### Full injected-sibling candidate list (screener O8/O8b + own search)
1. `src/functions/html.ts` per-command attribute policy (**picked as S1**). Farthest from the
   report's example command, plausible "inert attribute" policy, own key `title` gives a coupled
   legitimate value for the functional group. Beats the plain allowlist variants on distance and
   on the "markup policy, not authorization" dismissal.
2. `contrib/auto-render` new merged option (**picked as S2**). Different mechanism from every
   other route: the value becomes an own property, so a correct renderer fix cannot close it; a
   maintainer adding a trust passthrough is realistic; the published fix never touches the file.
3. `src/functions/href.ts` inert-protocol allowlist (mailto/tel exempt from trust). Rejected:
   same allowlist-bypass concept as S1 (design forbids more routes of one concept), and it sits
   on the example command's own file, so it is easier to find.
4. `src/Settings.ts` new object-valued setting consulted by the trust check. Rejected: same
   allowlist concept again, plus a public-schema/CLI surface change.
5. `src/Namespace.ts` second Namespace instance for counters/registers (O8b). Rejected: the
   published `Namespace.get` fix would close it too, so it cannot be an independent lever, and it
   adds a large unrelated feature.
6. `cli.js` schema-metadata prototype reads (O8). Rejected: only reachable through a built `dist`
   and the Node binary; grading would need a build and a CLI harness, and the route is outside
   the library rendering path.
7. `src/MacroExpander.ts:414` catcode lookup. Rejected: changes parsing, not the protected
   emit/permit outcome; noted out of scope (one line in the report).
8. `src/Parser.ts:507` `functions[name]` plain read. Rejected: a polluted JSON value cannot carry
   the handler function, and reaching it needs a definition-shaped object; no permission or
   emission impact found.
9. Symbol tables (`symbols`, `ligatures`). Rejected: glyph/ligature data, no permission decision.
10. `contrib/render-a11y-string` settings passthrough. Rejected: no permission or HTML emission.
11. `contrib/mathtex-script-type` script scanning. Rejected: not driven by caller options /
    prototype data.
12. `src/functions/includegraphics.ts` host allowlist. Rejected: same allowlist concept as S1.
13. `src/utils.ts` protocol cache. Rejected: contrived; no caller-supplied map in the tree.

### Sites / routes / shapes covered by security tests
- options own-read: global prototype, options-object prototype, bare URL command, image command.
- schema default and processor inherited.
- trust context: inherited protocol for href/url, inherited URL on a no-URL command, inherited
  protocol on a no-URL command (the shape an own-before-derive guard misses).
- macro namespace: inherited expansion, inherited name shadowing a builtin, undo capture.
- auto-render: inherited macros, inherited delimiters, re-materialised trust default.
- injected S1: inherited class / id exemption.
- functional: coupled values for each lever (functions in options, own-undefined fallback,
  settings instance, caller macro table, auto-render options including own trust, html tooltip
  exemption, project suite).

## Verified
- Pinned tree: every attack reproduces through `katex.renderToString` / `renderMathInElement`
  (local jest probe, 2026-10-27).
- Injected tree: S1 inheritance bypass and tooltip exemption reproduce; S2 inheritance reaches
  the renderer; project suites `test/katex-spec.ts` + `contrib/auto-render/test/auto-render-spec.ts`
  stay green (641 tests, 22 snapshots).
- Oracle tree: all probes blocked, both coupled values still work, project suites green.
- Full local matrix with the hidden suites and every checks/ patch (node 22.23.3, jest 30.4,
  jsdom; 22 security + 674 functional cases):

  | state | security | functional |
  |---|---|---|
  | pinned+injected (nop) | 0/22 (all fail) | 674/674 |
  | oracle | 22/22 | 674/674 |
  | miss_settings_options | 18/22 | 674/674 |
  | miss_schema_metadata | 19/22 | 674/674 |
  | miss_trust_context | 17/22 | 674/674 |
  | miss_macro_namespace | 19/22 | 674/674 |
  | miss_auto_render_options | 20/22 | 674/674 |
  | miss_auto_render_trust | 20/22 | 674/674 |
  | miss_html_attribute_policy | 19/22 | 674/674 |
  | sf-get-only | 21/22 | 674/674 |
  | sf-href-only | 18/22 | 674/674 |
  | ff-overbroad | 17/22 | 572/674 |
  | ff-refuse-trusted | 22/22 | 642/674 |
  | upstream_fix (published hunks only) | 10/22 | 674/674 |
  | pass-hardening | 22/22 | 674/674 |
  | pass-alt | 22/22 | 674/674 |

- The pinned tree holds no regression test for the fix (the fix commit adds the only one,
  "Settings prototype pollution" in test/katex-spec.ts); the image build asserts its absence.
- Register rows appended to build/audit/uncovered-routes.tsv for T3 and T7.

## Gate
- static: PASS (2026-10-27T22:42Z; no warnings; no missing-blind warning).
- nop: PASS (finished 22:47:18Z) — security 22 cases, all fail on the pinned+injected tree;
  functional 674 cases, all pass.
- oracle: PASS (finished 22:49:20Z) — 3/3 runs reward 1.0 with identical results; the first
  run's verifier results are security 22/22 + functional 674/674, reward 1.0.
- patches: PASS (finished ~22:55Z) — all 14 declared outcomes reproduced in-container:
  miss_settings_options 0.8182 (4 security fail), miss_schema_metadata 0.8636 (3),
  miss_trust_context 0.7727 (5), miss_macro_namespace 0.8636 (3), miss_auto_render_options
  0.9091 (2), miss_auto_render_trust 0.9091 (2), miss_html_attribute_policy 0.8636 (3),
  sf-get-only 0.9545 (1), sf-href-only 0.8182 (4), ff-overbroad 0.0 (102 functional fail),
  ff-refuse-trusted 0.0 (32 functional fail), pass-hardening 1.0, pass-alt 1.0,
  upstream_fix 0.4545 (12 security fail); every security_fail patch keeps functional at 674/674.

## Could not verify
- No live upstream check of the split/injected code (the injection exists only in this task).
- Whether an attacker-reachable pollution primitive exists inside KaTeX itself; the advisory
  assumes pollution supplied by another library (same assumption as the screener).
- `commander@8` argument order was not exercised (no CLI test).
