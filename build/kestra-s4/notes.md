# kestra-s4 — build notes

Start: 2026-10-29T11:44:19Z (session start marker)
End: 2026-10-29T12:22:50Z

Repository root used on this machine: `/home/runner/work/swe-benching/swe-benching`
(the build prompt's `/home/mara/cwe-bench` does not exist here; `common/paths.py`
resolves the root from the `.cwe-bench-root` marker, which is this checkout).
Scratch: `~/.tb-graders/cwe/work/kestra-s4/`.

## What the task is

Advisory GHSA-34PM-923J-7WF8 / CVE-2026-55839 (kestra-io/kestra). Kestra's browser UI
renders author-written Markdown through a shared renderer (`Markdown.render`) used by the
documentation/description component, the execution log line and the error message
container. The product's own link tag (`[[link ...]]`) emits a raw HTML element from the
tag's parsed attribute values, and the result is inserted with `v-html`. The published fix
(`6c8e6d0`, direct child of pinned `59eb318`) allowlists three attribute names in
`ui/src/utils/markdown_plugins/link.ts` and wires the log line's linkifier into the
documentation component.

Pinned = direct parent of the published fix. The fix diff has two files and no tests, so
there are no leaked regression tests between pinned and fix.

## The one property (written before choosing routes)

"Markdown written by a user must only ever produce the formatted document content the
product intends. No value the author writes may become active markup: no event handler,
script, stylesheet, embedded object or script-bearing URL may reach the rendered page
because of author-supplied text, whichever part of the rendering flow places that text."
Raw HTML an author writes directly in documentation Markdown is a supported feature and
is kept working by a functional test; the property is about text that Kestra's own
rendering turns into markup.

## Levers (one line each)

1. **T1 landing, published route.** The link tag's parsed attribute names are pasted into
   raw HTML; extra event-handler/style values become live attributes. `ui/src/utils/markdown_plugins/link.ts:22`.
   Reason to dismiss: it is the reported site (this is the one lever that is not meant to
   be missed; it makes the other three visible).
2. **T2 display-text consumer, injected, how-type.** A custom display text is a
   legitimate value of the tag; the step that turns the rendered element into router
   anchors re-parses that decoded value as HTML (`ui/src/components/logs/linkify.ts:47`).
   Reason to dismiss: "the report's example uses three values, so allowlisting those
   names is the whole fix". The published allowlist does not even include the display
   text, so copying it breaks the feature; keeping the name without fixing the consumer
   leaves the sink open. This lever is also the coupled must-keep-working value.
3. **T3 documentation shorthand, injected, how-type.** A `::key{key="..."}` shorthand is
   expanded into raw HTML in a pre-parse substitution step
   (`ui/src/utils/markdown.ts:54-56`). Reason to dismiss: "a cosmetic key-cap shorthand,
   not the link tag and not the Markdown parser". A fix placed in the parser or its
   renderer rules never sees it because the HTML exists before parsing.
4. **T4 rendered link title, injected, how-type.** A link title is escaped correctly by
   the renderer, then the post-render enhancement reads the decoded attribute and
   re-parses it with `innerHTML` to build a tooltip
   (`ui/src/components/layout/Markdown.vue:543`). Reason to dismiss: "the component only
   enhances already-rendered, already-escaped DOM". Escaping at the renderer cannot fix
   it; the value is decoded before it is re-used.

T1 is the published route. T2/T3/T4 are injected siblings: ordinary features of this copy
of the product, with no deceptive names or comments, reachable through the same real
entry points, covered only by the general property.

## Full candidate list and why the picks won

Real upstream candidates found by reading and by behavioural probes on the pinned copy:

- R1 `[[link]]` attribute interpolation (`link.ts`) — landing, published. Picked (T1).
- R2 enhanced code-fence language interpolation (`markdown.ts:119-144`, the screener's
  O8 lead). **Rejected after a behavioural probe**: the shiki highlighter receives the
  language token first and throws on an unknown language, so the interpolation is never
  reached; with a known language token plus trailing text only the known token is used
  for the label. No injection.
- R3 raw HTML pass-through (`html: true` in the docs component, log line and error
  container). Rejected: the advisory explicitly says the payload is not raw HTML and raw
  HTML in documentation is a supported feature. Kept working by a functional test (this
  is also the over-broad-fix trap).
- R4 alert container info string (`::alert{type=...}` -> `::: <type>`). Rejected:
  `markdown-it-container`'s default render only joins the configured name as a class and
  renders the token through `renderToken`; a probe showed the crafted type is escaped as
  paragraph text.
- R5 log line ordering (`xss()` -> URL regex -> Markdown). Rejected: `xss()` encodes
  `<`/`>` before the URL regex runs, so the URL text cannot become an element.
- R6 flow search `_escape()` + `[mark]` replacement. Rejected: content is escaped first.
- R7 table-to-card transform copying `innerHTML`. Rejected: it copies already-rendered
  DOM; it creates no new source of markup.
- R8 `toast.ts` `innerHTML` of a table cell. Rejected: different sink and different
  source; not the Markdown renderer and outside this advisory.
- R9 log line `textContent` for the three router values. Safe upstream; T2 makes the
  newly added display-text value unsafe.
- R10 documentation search filter. Rejected: textContent only.

Injected candidates considered:

- I1 a second wiki-style tag (`[[flow ...]]`/`[[badge ...]]`). Rejected: another route
  of one concept and a pure where-type search cost; the design rules discourage it.
- I2 a block container with a raw title (`::: callout <title>`). Rejected in favour of
  T3: it sits in the same renderer-rule layer as the fence, so a fixer auditing renderer
  rules finds both at once, and it repeats the "label" concept.
- I3 pre-parse shorthand substitution — picked (T3): different stage (before the
  parser), how-type, invisible to a parser/renderer-rule fix.
- I4 post-render link-title re-interpretation — picked (T4): after the check; escaping
  cannot fix it.
- I5 display text consumed by the linkifier — picked (T2): allowed value name,
  untrusted value, downstream sink in another module, and the coupled must-keep-working
  value that defeats the published allowlist.
- I6 a UI producer that builds `[[link ...]]` strings. Rejected: the renderer allowlist
  covers every producer, so it adds no separate mechanism.
- I7 a second lightweight renderer used by another component. Rejected: pure second
  implementation (where-type) and would need another component mount for no new
  mechanism.
- I8 a table/card enhancement reading an attribute. Rejected: less plausible than T4's
  tooltip and the same post-render mechanism.

## What was verified (locally, node 22 + jsdom)

- The pinned commit is the direct parent of the published fix; the fix touches two UI
  source files and no tests.
- Every lever reproduces on the injected pinned tree through a real entry point
  (component mounts for the documentation, error-message and log-line surfaces; the
  renderer output for the log line, which the component inserts with `v-html` before its
  enhancement runs).
- Security suite on the injected tree: 9/9 fail. Functional suite: 13/13 pass.
- Reference fix (published change + the three sibling fixes): 22/22 pass, from a fresh
  pinned checkout with `injection.patch` then `fix.patch`.
- Project unit suite with the injected tree: 17 files, 77 tests passed.
- 13 check patches applied to a fresh injected tree: each produces the declared result
  (security_fail patches leave at least one security test failing with all functional
  tests passing; functional_fail patches break the coupled behaviour; hardening and
  alternative fixes score 22/22).
- Gate: static PASS (strict); nop PASS (security 0/9 pass, functional 13/13 pass in
  the verifier container); oracle PASS (3/3 runs reward 1.0, identical); patches PASS
  (13/13 checks behave as declared). Evidence: `build/kestra-s4/*-stage.log`,
  `static-report.json`, `patches-report.json`, `gate-summary.json`.

## What could not be verified

- Whether the two target models fail all three attempts: no trials were run by this
  build (the build rules forbid running them here). The design bet is that the three
  injected siblings each need a different discovery path (consumer value, pre-parse
  stage, post-render re-interpretation) and that copying the published allowlist breaks
  the coupled display-text behaviour.
- Browser execution: jsdom parses the DOM but does not run scripts. The tests assert
  that no active markup (event-handler attributes, embedded elements, script-bearing
  URLs, the overlay style) is produced, which is the protection the advisory requires;
  they do not execute a payload.
- Presence of the injected features in current upstream: they are this copy's additions,
  not upstream code. The real upstream route is R1 only.
- The screener's "O8 fence" and "O8 raw HTML" leads: the first does not reproduce (R2),
  the second is outside the advisory and is kept working.

## Fairness concerns I see myself

- The hidden security tests drive the shared renderer output and mount the three
  product components. A fix that sanitises only inside one component is rejected for the
  other surfaces, which is correct because those surfaces stay open; a fix in the shared
  renderer or in each surface passes.
- T2 requires keeping the custom display text while making it inert. The report states
  "every value the product already reads ... must keep being used", so the requirement is
  discoverable, but a solver who copies the published three-name allowlist will fail the
  functional suite. That is the intended coupled-value lever.
- The instruction does not name the shorthand, the tooltip or the display-text field;
  they must be found by auditing the rendering flow. This is the intended difficulty.

## Out-of-scope observations (one line each, not built on)

- Raw HTML in documentation Markdown is a pass-through by design; out of this advisory.
- `ui/src/utils/toast.ts` renders a toast message with `innerHTML`; different sink and
  source, not part of this advisory.
- The advisory also lists `ui/src/utils/markdown.ts` as an affected component; the
  published fix does not change it.
