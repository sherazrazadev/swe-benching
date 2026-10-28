# appium-mcp-s4 — build notes

- Start (UTC): 2026-10-28T16:18:09Z
- End (UTC): 2026-10-28T16:52:00Z
- Repo: appium/appium-mcp; pinned 1655fbd41f462f43dc49fd78f15727db0e2fb6c3; published fix e222bbbd6fe2b656a320efcd143563f08061a83d (CWE-79).
- Track: injected. Pattern: B. Slug: appium-mcp-s4.
- Process note: this file was written after the build, not before it. The design below is the
  plan that the build actually followed; the ordering requirement was missed and is recorded
  here rather than glossed over.

## The one security property (stated once, in instruction.md)

No value the server obtains from the application under test may become executable code or
document structure in any view the server returns; wherever a view carries such a value it
must remain inert data, and a control that acts on a value must act on exactly that value.
The tests and both injected siblings fall under that sentence as written; the report never
names a route, file, function or context.

## Levers (one line each)

1. base_locator_card — pattern A (published fix's landing point). Locator-card values are
   interpolated into HTML text and into an inline `onclick` JavaScript string
   (src/ui/mcp-ui-utils.ts:720-740, 886-898). Reason the shallow repair is tempting: HTML-
   escaping every interpolation looks complete, but entity decoding happens before the
   JavaScript parser in an attribute, so the handler keeps executing; and the coupled
   requirement is that the Test control still sends the exact selector.
2. page_source_script — pattern B (real, unmodified upstream). The page-source viewer keeps
   the source in a JavaScript template literal in its generated script
   (src/ui/mcp-ui-utils.ts:1066). Reason to dismiss: the viewer already HTML-escapes the page
   source, so the route looks handled; the escape does not cover backtick or `${}`.
3. injected_attribute_view — injected. A new attribute-inspector view strips angle brackets
   and places the value in a quoted HTML attribute
   (src/ui/mcp-ui-utils.ts:1628-1700, src/tools/interactions/get-element-attribute.ts:60-80).
   Reason to dismiss: a read-only diagnostic that already removes angle brackets looks
   sanitised.
4. injected_locator_data — injected. A new locator-data view serializes the same page-derived
   data with `JSON.stringify` into a script element
   (src/ui/mcp-ui-utils.ts:1735-1815, src/tools/test-generation/locators.ts:90-105). Reason to
   dismiss: JSON-encoded data reads as safe data, and the second resource is easy to miss next
   to the locator list.

How-type levers: 1 (coupled must-keep-working value + context encoding), 2 (protection that
never existed in the JavaScript context), 3 (attribute-context mismatch), 4 (HTML parser
terminates a script element regardless of JSON quoting). Each has a different reason a solver
would skip or mis-fix it.

## Candidate inventory and why the picks won

Every rendered-view builder and every route to the same sink found in the pinned tree:

- createLocatorGeneratorUI (src/ui/mcp-ui-utils.ts:706) — the reported site. Built (base).
- createPageSourceInspectorUI (src/ui/mcp-ui-utils.ts:909) — page-source text in a generated
  script's template literal; also the search handler re-renders text through innerHTML.
  Picked: real upstream code the published fix never touches, how-type, a dismissal ("already
  escaped") that the advisory's own protection makes plausible, 340 lines from the landing
  point.
- createAppListUI (src/ui/mcp-ui-utils.ts:1247) — appName/packageName raw in text, a data
  attribute and three inline handlers. Not tested: app display names are supplied by *other*
  installed applications, outside the "application under test" data class the property
  protects; treating them as out of scope is a legitimate reading, so it would be an unfair
  lever. Recorded here.
- createDevicePickerUI (src/ui/mcp-ui-utils.ts:44) — device name/udid/state from adb/simctl.
  Not tested: not application-supplied data.
- createContextSwitcherUI (src/ui/mcp-ui-utils.ts:1087) — driver-generated context names
  (NATIVE_APP / WEBVIEW_<id>). Not tested: not attacker text.
- createSessionDashboardUI (src/ui/mcp-ui-utils.ts:454) — capabilities supplied by the caller
  creating the session. Not tested: self-inflicted, not the application under test.
- createScreenshotViewerUI (src/ui/mcp-ui-utils.ts:246) — server-generated path and
  driver-produced base64. Not tested: no attacker-controlled string.
- createTestCodeViewerUI (src/ui/mcp-ui-utils.ts:1465) — no caller at the pinned commit; its
  input would be assistant-authored code, not application data. Not tested.
- O8b candidate: a viewer for appium_get_element_attribute results. Picked, as
  injected_attribute_view: the house pattern (every read-only inspection tool returns a UI
  resource) makes it a natural maintainer addition, and the local stripTags() gives it a
  how-type attribute-context trap rather than a plain unescaped interpolation.
- O8b candidate: a second locator UI resource. Picked, as injected_locator_data: a
  copy-as-JSON view is the most complex of the candidates because the danger is in the HTML
  parser's raw-text handling of `<script>`, not in string quoting.
- Candidate: an element-text viewer for appium_get_text. Rejected: same mechanism as the
  attribute sibling, and a second sibling of one concept adds breadth, not difficulty.
- Candidate: a page-source JSON export view. Rejected: duplicate of the locator-data
  mechanism.

The two injected siblings are the most complex and hardest to find of the candidates: both are
reachable through real tools, both look protected (one strips markup, one is JSON), and both
sit in code the published fix never touches.

## Verified

- Flaw reproduces at the pinned commit through the real entry point: MCP tools driven over the
  MCP protocol (FastMCP + SDK InMemoryTransport); the only stub is the Appium driver object in
  the session store. HTML views rendered in jsdom with scripts enabled.
- Local before/after: pinned+injected security 0/9 pass, functional 4/4 pass; oracle security
  9/9, functional 4/4, project test 8/8.
- Gate: static PASSED, nop PASSED, oracle PASSED (3 identical runs, reward 1.0), patches PASSED.
- Patch outcomes (build/appium-mcp-s4/gate_report.partial.json): each security_fail patch leaves
  functional all passing; func_overbroad and func_escape_document fail functional; hardening and
  alt_fix score 1.0.
- The pristine project test src/tests/generate-all-locators.test.ts passes on pinned+injected and
  on the oracle in the verifier image.
- The published fix's regression test (src/tests/mcp-ui-utils.test.ts) is absent at the pinned
  commit; the injection adds no tests.
- Current upstream (read-only, FETCH_HEAD 2af3e65 on 2026-10-28): the page-source viewer has
  since been rewritten without the template-literal route, so the register row records
  present_in_latest=no.
- Register row appended to build/audit/uncovered-routes.tsv.

## Could not verify

- The two target models' 3/3 failure (trials and target models were explicitly out of scope for
  this build; only the gate was run).
- Behaviour in a real MCP-UI client: jsdom emulates the HTML parse and script execution, not
  the product's actual iframe renderer.
- Exact reproducibility of npm resolution across image builds: the repo sets
  package-lock=false, so both images resolve `^` ranges with `npm install` at build time. They
  were built minutes apart for this gate; a much later rebuild could drift.
- The real-device reachability of the app-list, context-switcher and device-picker routes was
  reasoned from the code, not observed; they are not tested.
- Upstream state of the injected siblings is not applicable (they are ours only).

## Out of scope (one line)

The generated scripts postMessage to the parent with targetOrigin '*' and the page-source search
box builds a RegExp from the typed term; both are outside this advisory's protection and were
not pursued.
