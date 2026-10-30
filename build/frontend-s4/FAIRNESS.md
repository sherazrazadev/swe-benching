# FAIRNESS — frontend-s4

Scope: the 18 hidden cases in `tasks/frontend-s4/tests` (9 security, 9 functional). The 13 pinned-project chart tests (`test/components/chart`, run with the functional group) are unrelated regression coverage and need no row.

## 1. Test-by-test fairness

| Test (file::name) | What it asserts | Fair because | Could a correct fix fail it? | Risk |
|---|---|---|---|---|
| security/statistics-graph::a statistic label is shown as text in the graph tooltip | friendly-name markup in the statistics line series name does not create an element; value "5.00" still shown | "A chart tooltip must display every value ... as text. No such value may be parsed as markup, create elements, or run — whichever chart displays it ..." | no — escaping `seriesName` in the card, or central output handling, passes | low |
| security/history-timeline::a state name is shown as text in the history timeline tooltip | item `name` markup is not parsed; safe name shown | same general sentence + "whichever object it describes" | no — escape `name`/`seriesName` in the formatter or centrally | low |
| security/chart-tooltip-list::a tooltip configured as one of several entries stays safe | a caller-supplied formatter interpolating `params.name` cannot emit an element | "... however the chart's tooltip content is configured or supplied." | maybe\* — a fix that only escapes values at each real source (never touches supplied formatters) fails; that fix does not meet the "supplied" clause. Central sanitization (`pass-alternative.patch`) passes | medium |
| security/chart-series-tooltip::a tooltip configured on a series stays safe | same, per-series tooltip form | "... however ... supplied." | maybe\* — same as above; must process `series[].tooltip` | medium |
| security/chart-options-series::a tooltip carried by a series supplied with the chart options stays safe | same, `options.series[].tooltip` | "... however ... supplied." | maybe\* — same; must process the options-merge route | medium |
| security/graph-node-tooltip::a network node name is shown as text in its own tooltip | per-data-item node tooltip escapes name/context | "... whichever object it describes, and however ... supplied." | no — escape in the item formatter, or central item-level handling | low |
| security/bluetooth-graph::a Bluetooth device name is shown as text in the network tooltip | device name in edge tooltip escaped | "... whichever chart displays it ..." | no — formatter or central fix | low |
| security/zha-graph::a Zigbee node name is shown as text in the network tooltip | node name in edge tooltip escaped | same | no | low |
| security/zwave-graph::a Z-Wave device name is shown as text in the network tooltip | device name in edge tooltip escaped | same | no | low |
| functional/statistics-graph::a legitimate statistic label, value and unit still render, once per series | safe name/value/unit, line breaks, one row per series | "Ordinary names ... still appear ... as text"; "Tooltips keep the formatting ..."; "Every other legitimate behaviour stays exactly as it is today." | no | low |
| functional/history-timeline::the timeline tooltip keeps its heading, times and line breaks | `h4`, name, duration and ≥3 `br` | "headings, line breaks"; "keep working" | no — any fix that keeps chart-owned markup passes | low |
| functional/chart-tooltip-list::a chart may supply several tooltip entries and each keeps working | two entries survive, both callable | "however ... configured or supplied"; "every chart keeps working with the way it is configured today." | no | low |
| functional/chart-series-tooltip::a tooltip configured on a series still renders its content | series tooltip remains callable and renders | same | no | low |
| functional/chart-options-series::a series supplied with the chart options still reaches the chart | series name/data preserved, formatter callable | same | no | low |
| functional/graph-node-tooltip::a network node keeps its name and context in the tooltip | node name + context text | "Ordinary names ..."; "keep working" | no | low |
| functional/bluetooth-graph::the Bluetooth network tooltip keeps its bold labels and values | `<b>` labels, arrow, rssi | "bold labels"; "keep working" | no — flattening markup is not a correct fix (violates "keep formatting") | low |
| functional/zha-graph::the Zigbee network tooltip keeps its bold labels and link quality | `<b>` labels, LQI, both names | same | no | low |
| functional/zwave-graph::the Z-Wave network tooltip keeps its bold labels and signal value | `<b>` labels, RSSI, both names | same | no | low |

\* Resolved in the verdict: a source-only escaping fix does not satisfy "however the chart's tooltip content is configured or supplied", so it is incomplete rather than correct.

## 2. Leniency (quality; non-blocking)

Property-level wrong fixes, caught:
- Stats-only or far-site-only treatment → `security/statistics-graph` (`sf-miss-stats.patch`), or `security/{history-timeline,bluetooth-graph,zha-graph,zwave-graph,graph-node-tooltip}` (`sf-miss-far.patch`).
- Single tooltip object only → `security/chart-tooltip-list` (`sf-miss-list.patch`).
- Chart-level tooltip only → `security/chart-series-tooltip` (`sf-miss-series.patch`).
- `.data` series only → `security/chart-options-series` (`sf-miss-options-series.patch`).
- No data-item tooltip handling → `security/graph-node-tooltip` (`sf-miss-injected.patch`).
- Flatten all markup → functional network/timeline cases (`ff-overbroad.patch`).
- Source-level escaping only → the three shape cases above.

Traps T1–T6 map to those rows in order (T1 stats, T2 far sites, T3 list, T4 per-series, T5 options.series, T6 data-item).

Wrong fixes no test catches:
- Special-casing the payload: every security case uses the same inert `<img src="x" data-pwn="1">`; a fix that strips `img`/`onerror` only passes.
- Blocking only `img,svg,script,iframe,object,embed`: `expectNoMarkup` ignores `<a href="javascript:">`, `<style>`, `<math>`, `<form>`, and event attributes on allowed tags (`<b onclick=...>`).
- Escaping only the one tainted field per route; unit, statistic metadata name, area, manufacturer/model, `context` are never tainted.
- Rebuilding `options.series` and dropping unrelated option keys (no test checks they survive).
- In-place mutation of a caller's memoized options/tooltip object (solution copies; no test freezes it).

## 3. Hints (quality; non-blocking)

- "Names do not come from the chart: an entity's friendly name, a statistic's label, and the names recorded for devices and areas all live in the entity and device registries." → "Names are values Home Assistant holds, not chart configuration."
- "An entity whose friendly name is `<img src=x onerror=...>` produces an image element inside the tooltip instead of showing the literal name." → "A recorded name that contains markup is inserted into the tooltip as markup instead of literal text."
- "The example above is an example, not the complete set." → delete; the property is already universal.
- "Fix the problem and its close variants." → "Fix the problem wherever it occurs."
- "Tooltips keep the formatting users see today: bold labels, headings, line breaks, value layout and colour indicators." → "Tooltips keep the formatting users see today."
- "those charts use rich HTML tooltips so labels can be bold, multi-line and colour-coded." → "those charts use rich tooltips."

## 3a. Required: generalize

These enumerate, in product terms, the object kinds, format and variants the hidden cases probe; they turn the task into a checklist. State the property once over protected data/outcome: *"No value Home Assistant holds may become part of a chart tooltip's structure; tooltips keep the formatting they have today."*

- "Names do not come from the chart: an entity's friendly name, a statistic's label, and the names recorded for devices and areas all live in the entity and device registries." (object kinds / sibling sources)
- "An entity whose friendly name is `<img src=x onerror=...>` produces an image element inside the tooltip instead of showing the literal name." (exact payload/format)
- "The example above is an example, not the complete set." (flaw count)
- "Fix the problem and its close variants." (variant count)
- "those charts use rich HTML tooltips so labels can be bold, multi-line and colour-coded." (format list)
- "Tooltips keep the formatting users see today: bold labels, headings, line breaks, value layout and colour indicators." (format list)

## 4. Realism

T1–T5 are real, unmodified upstream sites/routes at the pinned commit; leaving them is a solver failure, not over-reach. T6 is injected but ordinary: it mirrors the same file's chart-level formatter and is reached through `_getSeries`, used by all three network pages. One thing to confirm: `NetworkNode.context` should be a declared field so the injected lines read as maintainer code (vitest transpiles without typechecking, so a missing field would not fail but would look planted). `pass-alternative.patch` shows a second, non-Lit correct mechanism. No contrived trap found.

## Verdict

GATE A: READY. The general property on lines 19–23, read literally, covers every hidden route (all charts, all registry objects, and every tooltip configuration shape). Two independent correct fixes pass 18/18 — the Lit-template oracle and the central whitelist sanitiser (`pass-alternative.patch`) — so no assertion requires one error class, bypasses a valid layer, or contradicts the instruction. The only borderline item is the three shape tests: a fix that escapes values only at their real sources fails them, but that does not meet the instruction's explicit "however the chart's tooltip content is configured or supplied" clause; a fix following the stated property (central output handling) passes. No correct-fix-fails mechanism is established.

Quality to tighten: add a differently shaped payload (e.g. `<a href="javascript:...">`, `<svg onload=...>`, `<b onclick=...>`) and have `expectNoMarkup` reject unexpected elements plus `on*`/`javascript:` attributes; taint every value field per route (unit, metadata name, area, manufacturer/model, `context`); assert unrelated option keys survive `options.series` processing; freeze a caller options object to catch in-place mutation; optional: drop a functional formatting bullet in favour of the single "keep working" property.

Human review: confirm that "however the chart's tooltip content is configured or supplied" is intended to require neutralising caller-supplied formatter output (the list/series/options.series security cases), and that `NetworkNode.context` is a real field in the injected T6.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
