# frontend-s4 — build notes

Start: 2026-10-30T00:15:30Z
End: 2026-10-30T01:07:30Z

## Task shape

- Repo: home-assistant/frontend, pinned 4a6c23c93e0cf24c26721090ba168a853b91843f.
  Published fix b8c201b6d34414d30c622797366570185c219614 (23 files) reduces the advisory to:
  chart tooltips are raw HTML strings; data-derived names (entity/statistic/device/area/
  manufacturer/model, unit, state name) must be escaped where the string is assembled.
- Pattern A, injected track. Security property: every value Home Assistant holds for a
  registered object must appear in a chart tooltip as text, wherever the chart is and however
  its tooltip content is configured or supplied.
- Instruction word count: 330.

## Levers (one line each)

- T1 (A, report target, how-type): `statistics-chart.ts:335` interpolates `param.seriesName`;
  the shared element's `filterXSS` of series names at `ha-chart-base.ts:991` is skipped by the
  minmax branch the statistics line series always take. Dismissal: the series name looks
  already sanitised upstream.
- T2 (A, far sites): the same raw assembly exists in the history timeline tooltip and in the
  Bluetooth, Zigbee and Z-Wave network tooltips; each is a different component that owns its
  formatter. Dismissal: the report names the statistics graph.
- T3 (shape): `options.tooltip` may be a list of tooltip options (the element's mobile branch
  proves it); a fix that processes one object misses the list.
- T4 (shape): a tooltip may be configured on a series rather than on the chart.
- T5 (merge / lower-level public API): series handed through `options.series` are spread over
  the processed data series in the update path (`_createOptions` `...this.options`), so the
  shared tooltip processing never sees them. This route is still present on upstream `dev`
  today. Dismissal: in-tree cards pass series through `.data`.
- T6 (injected): `ha-network-graph.ts` data builder attaches a per-node tooltip built from the
  node name and context. Item-level tooltips are a shape the shared processing does not reach.
  Dismissal: the network pages already pass a chart-level tooltip formatter, so the per-node
  tooltip reads as redundant label configuration.

## Candidate list (before choosing)

Sibling sites/routes found: (1) statistics graph series-name tooltip (report target); (2) history
timeline item name; (3) history line unit/state value (line formatter already `filterXSS`es
`seriesName`; the unit route was not confirmed as attacker-controlled, so it is not used);
(4) Bluetooth device/area names; (5) ZHA node/device/area names; (6) Z-Wave
device/manufacturer/model/area names; (7) sankey node labels (`filterXSS` present at pinned, so
safe and used only as a functional precedent, not a security case); (8) sunburst name
(`filterXSS` present, safe); (9) energy chart series names (`filterXSS` present) and the
devices graph (series name is a localized constant — not attacker data); (10) tooltip list form;
(11) per-series tooltip form; (12) options.series override; (13) item-level tooltip; (14) string
tooltip templates with literal data (ECharts encodes only `{a}`/`{b}`/`{c}` substitutions, the
published fix passes strings through untouched); (15) hardware-overview tooltip
(`valueFormatter`, encoded by ECharts; no registry data — rejected).

Picks: T1 (report target and the only shared sanitising branch), T2 (four far components, each a
separate formatter), T3/T4 (two different input shapes), T5 (real merge route the published fix
misses) and T6 (injected item-level sibling). T3/T4/T5 are how-type: each needs the merge/priority
mechanism understood. T6 was chosen over the string-template candidate because it is reachable
through a real component without changing any existing chart's tooltip behaviour for the panels'
edges, and because item-level tooltip priority is the hardest of the candidates to notice. The
string-template candidate was rejected as a sibling (its legitimate HTML would be flattened by
the published fix's Lit wrapper, which the agent would see as a required behaviour).

## Injected sibling

`environment/injection.patch` adds 8 lines in `src/components/chart/ha-network-graph.ts`
(`_getSeriesData`): each node data item gets `tooltip.formatter` rendering the node name and
context. It is ordinary chart code, it is reached through the graph element used by all three
network pages, and the published fix never edits that builder. The oracle escapes the values.

## What was verified (local, jsdom, pinned/injected tree and oracle tree)

- Pinned+injection: 9/9 security cases fail (each produces an `<img data-pwn>` element from the
  inert payload), 9/9 functional cases pass, the pinned project chart checks (13 cases) pass.
- Oracle (published fix + options.series processing + injected-formatter escaping): 18/18 pass.
- Published fix alone: exactly the options.series and injected item-level routes remain
  vulnerable; everything else passes, which is why both are fixed in `solution/fix.patch`.
- Check patches, each run against the pinned+injected baseline:
  - sf-miss-stats: 1 security fail, functional pass.
  - sf-miss-far: 8 security fail, functional pass.
  - sf-miss-list: 1 security fail, functional pass.
  - sf-miss-series: 1 security fail, functional pass.
  - sf-miss-options-series: 1 security fail, functional pass.
  - sf-miss-injected: 1 security fail, functional pass.
  - ff-overbroad: security pass, 5 functional fail (all rich formatting flattened).
  - pass-hardening: 18/18 pass.
  - pass-alternative (central whitelist sanitiser for chart, series, list, options-supplied and
    item-level tooltips; no Lit conversion): 18/18 pass.

## Not verified / guesses

- Gate stages, run in order with `--only`: static PASS; nop PASS; oracle PASS (3 runs);
  patches PASS (9/9). Each stage wrote `build/frontend-s4/gate_report.partial.json` and its own
  `*-stage.log`; the per-check outcomes are recorded below. Time stamps: nop finished 00:54:51Z,
  oracle 00:58:21Z, patches 01:07:07Z.
- Whether DeepSeek V4.1 Flash and MiMo-V2.6-Pro fail all three attempts is decided by the trials,
  not by this build.
- The advisory body beyond its one-line summary was unavailable; the design comes from the
  published fix and the pinned tree.
- The published fix's own upstream test was not included in the solution patch (source only).
- The verifier swaps only `/workspace/src` into the pristine tree; a submission that changes
  build configuration outside `src` is not carried over. No legitimate fix needs that here.

## Scope notes

- Other `filterXSS` users at this pinned commit (`src/components/map/ha-map.ts`,
  `src/resources/markdown-worker.ts`) guard different sinks and were not examined.
- `environment/Dockerfile` uses `/workspace` (the delivery format enforced by
  `common/builder/conformance_check.py`), not `/app` as the generic build prompt says. The
  separate-mode test script deliberately does not carry the shared-mode agent-kill block,
  because conformance rejects it in a separate verifier.

## Gate results (2026-10-30)

- static: PASS (only the downstream blind patch and FAIRNESS.md remain unproduced).
- nop: PASS. 0 of 9 security cases pass on the pinned+injected tree (all nine produce the inert
  marker element) and 22 of 22 functional cases pass (9 task cases + the pinned project's 13
  chart cases); reward 0.0.
- oracle: PASS. Three runs, each reward 1.0, 31/31 cases, identical result maps.
- patches: PASS, every check behaved as declared:
  - sf-miss-stats (security_fail): 1 security fail, 0 functional fail.
  - sf-miss-far (security_fail): 8 security fail, 0 functional fail.
  - sf-miss-list (security_fail): 1 security fail, 0 functional fail.
  - sf-miss-series (security_fail): 1 security fail, 0 functional fail.
  - sf-miss-options-series (security_fail): 1 security fail, 0 functional fail.
  - sf-miss-injected (security_fail): 1 security fail, 0 functional fail.
  - ff-overbroad (functional_fail): 0 security fail, 5 functional fail.
  - pass-hardening (pass): reward 1.0.
  - pass-alternative (pass): reward 1.0.
