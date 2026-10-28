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

Project root: `/home/mara/cwe-bench`. Task: `frontend-s4`. Pattern: `A`. Track: `injected`.

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
- Advisory: ["GHSA-WX4M-69M9-GX3M", "CVE-2026-91130", "PYSEC-2026-4052"]; home-assistant/frontend; xss
- Pinned (vulnerable) commit: 4a6c23c93e0cf24c26721090ba168a853b91843f. Published fix: b8c201b6d34414d30c622797366570185c219614.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "6230",
 "advisory_ids": [
  "GHSA-WX4M-69M9-GX3M",
  "CVE-2026-91130",
  "PYSEC-2026-4052"
 ],
 "repo": "home-assistant/frontend",
 "pinned_commit": "4a6c23c93e0cf24c26721090ba168a853b91843f",
 "fix_commits": [
  "b8c201b6d34414d30c622797366570185c219614"
 ],
 "trust_decision": {
  "summary": "The echarts tooltip is raw HTML (`renderMode: \"html\"`): anything a formatter interpolates from registry/recorder data (statistic label, entity friendly name, device/area/manufacturer/model, unit) is parsed as markup, so it must be escaped where the tooltip string is assembled. At this commit the only shared guard is `filterXSS` on the series name inside `ha-chart-base._getSeries`, and the Statistics Graph Card tooltip concatenates `param.seriesName` straight into its HTML string, so it is safe only while that guard runs - and the guard is skipped for the `sampling: \"minmax\"` line series the statistics card always creates.",
  "evidence": [
   "src/components/chart/statistics-chart.ts:335",
   "src/components/chart/statistics-chart.ts:697",
   "src/components/chart/ha-chart-base.ts:979-992",
   "src/common/util/xss.ts:3-8",
   "src/data/recorder.ts:346-356"
  ]
 },
 "landing_point": {
  "where": "src/components/chart/statistics-chart.ts:335",
  "why": "The advisory names the Statistics Graph Card; this is the only line in that card that pastes a data-derived name (`param.seriesName`) into the tooltip HTML string."
 },
 "fix_sites": [
  {
   "where": "src/components/chart/ha-chart-base.ts:955-995",
   "entry_point": "<ha-chart-base> custom element: `.data` series + `.options` supplied by every chart in the app",
   "module_kind": "shared chart component (series/tooltip pipeline, the sink's only shared escape point)"
  },
  {
   "where": "src/components/chart/ha-chart-base.ts:760-776",
   "entry_point": "<ha-chart-base> `.options.tooltip` (single object or array), also the mobile confine/appendTo rewrite",
   "module_kind": "shared chart component"
  },
  {
   "where": "fix.diff:400-441",
   "entry_point": "wrapLitTooltipFormatter (new module used by the base chart)",
   "module_kind": "new shared util in src/components/chart"
  },
  {
   "where": "fix.diff:220-256",
   "entry_point": "<ha-chart-tooltip-marker> (new element replacing echarts' params.marker HTML)",
   "module_kind": "new shared chart element"
  },
  {
   "where": "fix.diff:1687-1715",
   "entry_point": "HaECOption / HaTooltipOption / LitTooltipFormatter types re-exported from resources/echarts",
   "module_kind": "type layer (resources/echarts)"
  },
  {
   "where": "src/resources/echarts/echarts.ts:55-71",
   "entry_point": "ECOption type export consumed by every card",
   "module_kind": "type layer"
  },
  {
   "where": "src/components/chart/statistics-chart.ts:247-339",
   "entry_point": "<statistics-chart> used by hui-statistics-graph-card and ha-more-info-history",
   "module_kind": "chart component"
  },
  {
   "where": "src/components/chart/state-history-chart-line.ts:142-222",
   "entry_point": "history graph card (state-history-chart-line)",
   "module_kind": "chart component"
  },
  {
   "where": "src/components/chart/state-history-chart-timeline.ts:135-170",
   "entry_point": "history graph card (state-history-chart-timeline)",
   "module_kind": "chart component"
  },
  {
   "where": "src/components/chart/ha-sankey-chart.ts:99-114",
   "entry_point": "<ha-sankey-chart> used by power/energy/water sankey cards",
   "module_kind": "chart component"
  },
  {
   "where": "src/components/chart/ha-sunburst-chart.ts:69-75",
   "entry_point": "<ha-sunburst-chart> used by the storage breakdown chart",
   "module_kind": "chart component"
  },
  {
   "where": "src/components/chart/ha-network-graph.ts:79-81",
   "entry_point": "<ha-network-graph> public `tooltipFormatter` property",
   "module_kind": "chart component (public callback API)"
  },
  {
   "where": "src/panels/lovelace/cards/energy/common/energy-chart-options.ts:180-215",
   "entry_point": "energy dashboard graph cards via getCommonOptions()",
   "module_kind": "lovelace card options builder"
  },
  {
   "where": "src/panels/lovelace/cards/energy/common/energy-chart-options.ts:287",
   "entry_point": "same getCommonOptions() tooltip rows",
   "module_kind": "lovelace card options builder"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-energy-devices-graph-card.ts:201-210",
   "entry_point": "energy devices graph card tooltip (pie/bar)",
   "module_kind": "lovelace card"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-energy-usage-graph-card.ts:212-240",
   "entry_point": "energy usage graph card tooltip override",
   "module_kind": "lovelace card"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-energy-devices-detail-graph-card.ts:219",
   "entry_point": "energy devices detail graph card",
   "module_kind": "lovelace card (type-only change)"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-energy-gas-graph-card.ts:180",
   "entry_point": "energy gas graph card",
   "module_kind": "lovelace card (type-only change)"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-energy-solar-graph-card.ts:178",
   "entry_point": "energy solar graph card",
   "module_kind": "lovelace card (type-only change)"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-energy-water-graph-card.ts:180",
   "entry_point": "energy water graph card",
   "module_kind": "lovelace card (type-only change)"
  },
  {
   "where": "src/panels/lovelace/cards/energy/hui-power-sources-graph-card.ts:151",
   "entry_point": "power sources graph card",
   "module_kind": "lovelace card (type-only change)"
  },
  {
   "where": "src/panels/config/integrations/integration-panels/bluetooth/bluetooth-network-visualization.ts:333-370",
   "entry_point": "Bluetooth panel network visualization",
   "module_kind": "panel page"
  },
  {
   "where": "src/panels/config/integrations/integration-panels/zha/zha-network-visualization-page.ts:134-175",
   "entry_point": "ZHA panel network visualization",
   "module_kind": "panel page"
  },
  {
   "where": "src/panels/config/integrations/integration-panels/zwave_js/zwave_js-network-visualization.ts:153-200",
   "entry_point": "Z-Wave JS panel network visualization",
   "module_kind": "panel page"
  }
 ],
 "O1_entry_points": 10,
 "O2_out_of_scope_site": {
  "kind": "lower_level_api",
  "where": "src/components/chart/ha-chart-base.ts:955-995"
 },
 "O3_reason_to_dismiss": "The series name is already run through `filterXSS` in the shared chart base (`ha-chart-base.ts:991`), so the Statistics Graph Card tooltip can be treated as inheriting a sanitised name; the other tooltip formatters sit in unrelated chart/page components (sankey, sunburst, history, energy, bluetooth/zha/zwave) that each look after their own escaping, so a fix scoped to the reported card looks complete.",
 "O4_distance": {
  "files": 22,
  "packages": 4,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Tooltips are deliberately rich HTML that must keep rendering: echarts' own `params.marker` coloured span, `<b>` labels, `<h4>` titles, `<br>` separators and `<div style=\"direction:ltr\">` value wrappers, plus an RTL marker for Arabic/Hebrew locales; on mobile the base chart also mutates `tooltip.confine/appendTo/triggerOn` in place on the caller's options object, which callers cache with memoizeOne. A blanket escape of the whole formatter output (or a filterXSS over the assembled string) kills the marker and the layout, and rewriting the caller's options in place pollutes the memoised object across chart instances.",
  "where": "src/components/chart/ha-chart-base.ts:760-776"
 },
 "O6_input_shapes": [
  "chart-level `options.tooltip` as one object or as an array of tooltip options",
  "formatter as a function vs a string template (`{a}` placeholders) that the fix deliberately passes through untouched",
  "per-series `series[].tooltip.formatter`, not only the chart-level tooltip",
  "formatter return value: TemplateResult vs `nothing`/null/undefined (must suppress the tooltip, not show an empty box)",
  "`trigger: \"axis\"` (array of params, with de-duplication by seriesIndex) vs `trigger: \"item\"` (single param)",
  "line series with `sampling: \"minmax\"` vs bar series (the name-sanitising branch is skipped on the first)",
  "data-derived fields: statistic label incl. external-statistics metadata name, entity friendly name, device/area/manufacturer/model strings, `unit`"
 ],
 "O7_producer": {
  "kind": "mapper",
  "where": "src/components/chart/ha-chart-base.ts:955-995",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "src/components/chart/ha-chart-base.ts:274-275",
   "sibling": "a formatter carried on `options.series` (or a third echarts HTML option such as a legend/axisPointer formatter) instead of on `.data`",
   "why_realistic": "`_createOptions()` spreads `...this.options` after `chartOptions.series = this._getSeries()`, so a series/option contributed through `.options` overrides the processed ones and never sees the tooltip wrapping; cards already hand whole ECOption objects to this element, so a maintainer adding an option there is natural."
  },
  {
   "where": "src/panels/lovelace/cards/energy/common/energy-chart-options.ts:180-215",
   "sibling": "a new energy card that composes `getCommonOptions()` and overrides `tooltip.formatter` with a function that returns a hand-built string",
   "why_realistic": "Six energy cards already spread and override this shared formatter (hui-energy-usage-graph-card.ts:212-240 demonstrates the pattern), and a string return is still a valid ECharts formatter, so nothing forces the new code through the Lit wrapper."
  },
  {
   "where": "src/components/chart/state-history-chart-timeline.ts:135-170",
   "sibling": "another custom-series chart (e.g. a new history/statistics variant) whose tooltip interpolates `name`/`seriesName` taken from user-set entity names",
   "why_realistic": "Charts here are added one component at a time and each owns its own formatter; this file is exactly that pattern, with the tooltip built from `stateInfo.name`/`names[entity_id]`."
  }
 ],
 "O9_family": "xss",
 "O9_dos": false,
 "O10_build": {
  "language": "TypeScript (Lit web components, ECharts)",
  "toolchain": "Node + yarn; `script/build_frontend` (vite/rollup) for the bundle, `tsc` and eslint for checks; tests via vitest",
  "services": [],
  "offline_after_build": true,
  "project_tests": "`yarn test` = `vitest run --config test/vitest.config.ts` with `environment: \"jsdom\"`; the chart area has only pure-function tests (test/components/chart/chart-tooltip-position.test.ts, test/components/chart/y-axis-fraction-digits.test.ts) and test/setup.ts stubs only window/navigator - no canvas or matchMedia mocks, so chart rendering itself is not tested."
 },
 "O11_fix_minutes": 50,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/components/chart/ha-chart-base.ts, src/components/chart/lit-tooltip-formatter.ts, src/components/chart/ha-chart-tooltip-marker.ts, src/components/chart/ha-network-graph.ts, src/components/chart/ha-sankey-chart.ts, src/components/chart/ha-sunburst-chart.ts, src/components/chart/state-history-chart-line.ts, src/components/chart/state-history-chart-timeline.ts, src/components/chart/statistics-chart.ts, src/panels/config/integrations/integration-panels/bluetooth/bluetooth-network-visualization.ts, src/panels/config/integrations/integration-panels/zha/zha-network-visualization-page.ts, src/panels/config/integrations/integration-panels/zwave_js/zwave_js-network-visualization.ts, src/panels/lovelace/cards/energy/common/energy-chart-options.ts, src/panels/lovelace/cards/energy/hui-energy-devices-detail-graph-card.ts, src/panels/lovelace/cards/energy/hui-energy-devices-graph-card.ts, src/panels/lovelace/cards/energy/hui-energy-gas-graph-card.ts, src/panels/lovelace/cards/energy/hui-energy-solar-graph-card.ts, src/panels/lovelace/cards/energy/hui-energy-usage-graph-card.ts, src/panels/lovelace/cards/energy/hui-energy-water-graph-card.ts, src/panels/lovelace/cards/energy/hui-power-sources-graph-card.ts, src/resources/echarts/echarts.ts, src/resources/echarts/ha-ec-option.ts",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Wrap `param.seriesName` in `filterXSS(...)` inside statistics-chart._renderTooltip and stop there, leaving the other nine tooltip formatters and the shared series pipeline untouched."
 },
 "out_of_scope_notes": [
  "Other `filterXSS` users at this commit (src/components/map/ha-map.ts, src/resources/markdown-worker.ts) guard different sinks (Leaflet popups, markdown) and were not examined."
 ],
 "unverified": [
  "Repository size in MB could not be measured (no shell); it is clearly far above 5 MB of source and not a 1.5 GB checkout, so neither tiny_repo nor giant_repo is claimed.",
  "Whether a hidden test can drive the real card end to end: `echarts.init` at src/components/chart/ha-chart-base.ts:488 uses the canvas renderer and test/setup.ts provides no canvas or matchMedia mocks, so graders would likely have to call the tooltip formatter directly on the component rather than hover a rendered chart.",
  "Whether ECharts escapes `{a}`/`{b}` substitution for string-template tooltip formatters (relevant to the string-formatter passthrough) - not checked; no string tooltip formatter exists at this commit.",
  "The advisory body beyond its one-line summary was not available; only the published fix and the pinned tree were read."
 ]
}
  ```
- Published fix sites:   - src/components/chart/ha-chart-base.ts:955-995 — entry point: <ha-chart-base> custom element: `.data` series + `.options` supplied by every chart in the app [shared chart component (series/tooltip pipeline, the sink's only shared escape point)]
  - src/components/chart/ha-chart-base.ts:760-776 — entry point: <ha-chart-base> `.options.tooltip` (single object or array), also the mobile confine/appendTo rewrite [shared chart component]
  - fix.diff:400-441 — entry point: wrapLitTooltipFormatter (new module used by the base chart) [new shared util in src/components/chart]
  - fix.diff:220-256 — entry point: <ha-chart-tooltip-marker> (new element replacing echarts' params.marker HTML) [new shared chart element]
  - fix.diff:1687-1715 — entry point: HaECOption / HaTooltipOption / LitTooltipFormatter types re-exported from resources/echarts [type layer (resources/echarts)]
  - src/resources/echarts/echarts.ts:55-71 — entry point: ECOption type export consumed by every card [type layer]
  - src/components/chart/statistics-chart.ts:247-339 — entry point: <statistics-chart> used by hui-statistics-graph-card and ha-more-info-history [chart component]
  - src/components/chart/state-history-chart-line.ts:142-222 — entry point: history graph card (state-history-chart-line) [chart component]
  - src/components/chart/state-history-chart-timeline.ts:135-170 — entry point: history graph card (state-history-chart-timeline) [chart component]
  - src/components/chart/ha-sankey-chart.ts:99-114 — entry point: <ha-sankey-chart> used by power/energy/water sankey cards [chart component]
  - src/components/chart/ha-sunburst-chart.ts:69-75 — entry point: <ha-sunburst-chart> used by the storage breakdown chart [chart component]
  - src/components/chart/ha-network-graph.ts:79-81 — entry point: <ha-network-graph> public `tooltipFormatter` property [chart component (public callback API)]
  - src/panels/lovelace/cards/energy/common/energy-chart-options.ts:180-215 — entry point: energy dashboard graph cards via getCommonOptions() [lovelace card options builder]
  - src/panels/lovelace/cards/energy/common/energy-chart-options.ts:287 — entry point: same getCommonOptions() tooltip rows [lovelace card options builder]
  - src/panels/lovelace/cards/energy/hui-energy-devices-graph-card.ts:201-210 — entry point: energy devices graph card tooltip (pie/bar) [lovelace card]
  - src/panels/lovelace/cards/energy/hui-energy-usage-graph-card.ts:212-240 — entry point: energy usage graph card tooltip override [lovelace card]
  - src/panels/lovelace/cards/energy/hui-energy-devices-detail-graph-card.ts:219 — entry point: energy devices detail graph card [lovelace card (type-only change)]
  - src/panels/lovelace/cards/energy/hui-energy-gas-graph-card.ts:180 — entry point: energy gas graph card [lovelace card (type-only change)]
  - src/panels/lovelace/cards/energy/hui-energy-solar-graph-card.ts:178 — entry point: energy solar graph card [lovelace card (type-only change)]
  - src/panels/lovelace/cards/energy/hui-energy-water-graph-card.ts:180 — entry point: energy water graph card [lovelace card (type-only change)]
  - src/panels/lovelace/cards/energy/hui-power-sources-graph-card.ts:151 — entry point: power sources graph card [lovelace card (type-only change)]
  - src/panels/config/integrations/integration-panels/bluetooth/bluetooth-network-visualization.ts:333-370 — entry point: Bluetooth panel network visualization [panel page]
  - src/panels/config/integrations/integration-panels/zha/zha-network-visualization-page.ts:134-175 — entry point: ZHA panel network visualization [panel page]
  - src/panels/config/integrations/integration-panels/zwave_js/zwave_js-network-visualization.ts:153-200 — entry point: Z-Wave JS panel network visualization [panel page]
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

## Environment (`tasks/frontend-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/frontend-s4/instruction.md`)
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

## Tests (`tasks/frontend-s4/tests/`)
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
- **Wrong-fix patches** go in `build/frontend-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/frontend-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/frontend-s4/manifest.json`:**
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

**Also in `build/frontend-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py frontend-s4 --only static
python3 -I common/gate/gate.py frontend-s4 --only nop
python3 -I common/gate/gate.py frontend-s4 --only oracle
python3 -I common/gate/gate.py frontend-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/frontend-s4/`;
  - edit only `tasks/frontend-s4/`, `build/frontend-s4/` and, for pattern B, the register;
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
