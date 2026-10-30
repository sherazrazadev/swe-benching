# Post-run audit: frontend-s4__yfBfJRQ

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6667.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model fixed every in-tree tooltip call site. It applied filterXSS to names in the statistics, timeline, line, network-graph, Bluetooth, ZHA, Z-Wave and energy formatters, and it moved the series-name filterXSS in ha-chart-base so the minmax-downsampling branch no longer skips it. All 6 security tests on concrete product paths pass, and so do all functional tests. The 3 failing security tests check one property: the shared <ha-chart-base> element must neutralize names that a caller-supplied tooltip formatter puts into its output. The tests cover three ways of attaching that formatter: on a series in .data, on a series in options.series, and as an entry in an options.tooltip array. The model never changed how ha-chart-base handles tooltip formatters, so in all three cases the caller's string output reaches the tooltip as raw markup. The instruction explicitly covers this: values must stay text 'whichever chart displays it ... and however the chart's tooltip content is configured or supplied' (instruction.md:19-23). The model also read the Array.isArray(options.tooltip) branch in ha-chart-base (transcript.md:9) and did not act on it. More than one design passes: wrapping formatters so their output renders as text (the reference), or sanitizing params / whitelist-sanitizing output centrally (build-notes.md:85-86, 'pass-alternative ... 18/18'). So these tests are not tied to one implementation. The confidence is medium, not high, for two reasons. First, the failing cases are hardening of the chart element's API rather than demonstrated in-tree data flows: build-notes.md:31-32 says in-tree cards pass series through .data. Second, the tests feed the payload straight into the formatter's params, so only formatter-level hardening can pass. There were no harness problems: grading finished, tool_calls_during_grading is empty, and there is no exception.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/chart-series-tooltip > a tooltip configured on a series stays safe | fail | genuine-fail | True | True |
| security/chart-options-series > a tooltip carried by a series supplied with the chart options stays safe | fail | genuine-fail | True | True |
| security/chart-tooltip-list > a tooltip configured as one of several entries stays safe | fail | genuine-fail | True | True |
| security/statistics-graph > a statistic label is shown as text in the graph tooltip | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The transcript contains no reads of tests/, __verifier__ or the hidden test paths, and no web, GitHub or advisory lookups. The agent's network-free commands were limited to node checks against the local xss and echarts packages (transcript.md:70-145). No netguard.log is present.

**Evidence:**
- grading/results.json:4-6 — only chart-options-series, chart-series-tooltip and chart-tooltip-list fail; every functional test passes
- instruction.md:19-23 — 'whichever chart displays it, whichever object it describes, and however the chart's tooltip content is configured or supplied'
- tests/support/harness.ts:62-89 — processChart drives a real HaChartBase.willUpdate and captures setOption; mountTooltip sets string output via innerHTML
- changes.patch:307-334 — the model's only ha-chart-base change: the series-name filterXSS moved ahead of the minmax branch; tooltip formatters are not touched
- solution/fix.patch:46-70,125-160 — the reference wraps function formatters on chart-level tooltips, tooltip arrays, .data series and options.series
- build-notes.md:26-32 — T3/T4/T5 are deliberate shape levers; T5 dismissal: 'in-tree cards pass series through .data'
- build-notes.md:85-86 — a central whitelist-sanitizer alternative with no Lit conversion also passes 18/18
- transcript.md:9 — the agent saw the Array.isArray(options.tooltip) branch in ha-chart-base
- run.json timing — tool_calls_during_grading: [], exception_info: null

**Recommended action:** Accept the 0.6667 reward as a model-failed result: the model hardened in-tree call sites but not the shared chart element's handling of formatters, which the instruction asks for. You could also make the instruction more explicit that the shared chart element must neutralize caller-supplied formatter output, or add a test that shows a real in-tree caller using these shapes. Either would make the T3/T4/T5 failures easier to defend.
