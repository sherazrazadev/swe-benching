# cms-s5 build notes

- Slug: `cms-s5`
- Advisory: GHSA-24X4-J6X9-RFW5 / CVE-2026-55790 (CWE-79 DOM XSS), craftcms/cms
- Pinned (vulnerable): 3219a2ed290062d1075fc461e4a54b1ffbec58f7
- Published fix: 6bbb66038a268552180ca5c8eed9f46ea25a4417
- Pattern: A+B, track: injected
- Start (UTC): 2026-10-28T20:33:06Z (builder prompt), work started 2026-10-28T20:40Z

## What the product does

Craft CMS is a PHP content management system. Its control panel contains a "Craft Support"
dashboard widget. The widget lets an administrator search Stack Exchange and GitHub for similar
questions/issues, and send a support request to Craft. Search responses arrive as JSON and are
rendered client-side by a webpack-built browser asset. Support-form responses are rendered in a
hidden iframe and parsed by the same widget.

## Verified vulnerability (pinned commit, real widget entry point)

Two DOM sinks in `src/web/assets/craftsupport/src/CraftSupportWidget.js`:

1. `handleSearchSuccess` builds an anchor with jQuery's `html:` option from
   `<span class="status ...">` + `getSearchResultText(result)` (the remote result title).
   `getSearchResultText` returns `result.title` for both API screens (GitHub feedback and
   StackExchange help). Remote text becomes markup. (line 382)
2. `parseSupportResponse` builds `$('<li>' + error + '</li>')` from
   `response.errors[attribute][i]` (server validation messages that echo submitted values).
   (line 555)

The published fix escapes the title (`Craft.escapeHtml(...)`) and switches the error list item to
`$('<li/>', {text: error})`, and also patches the generated bundle
`dist/CraftSupportWidget.js`, which is the only JS `CraftSupportAsset` serves.

Reproduced offline in a jsdom harness that loads the real source and the real served bundle,
instantiates the widget DOM and drives the real response handlers.

## Security property (written once, before routes)

No text that the support widget receives from a remote service, or that it receives in a response
from the server, may be interpreted as markup or script anywhere the widget displays it. Such text
must appear as literal characters. The widget's own surrounding presentation — its status
indicators and result links — must keep working exactly as today, and legitimate text must keep
appearing wherever it appears today.

The property is deliberately over "text the widget receives" and "anywhere the widget displays it"
so it covers every tested route without naming one.

## Levers (each with a different reason to dismiss/skip)

- **L4 (main, HOW-type, injected): the search-result preview.**
  Injected, realistic maintainer code: hovering a result shows a preview built from the remote
  result's `body` field (`getSearchResultPreview` -> `.html(...)` into `.cs-result-preview`).
  The published fix never touches it. It is a second rendering path for remote text, in a
  different function, different data field and different UI surface.
  *Reason to dismiss/skip:* "the report is about the result title; the preview is a separate,
  read-only affordance, and only the title is named." Covered by the general property.

- **L2 (where-type, Pattern A): the served bundle** `src/web/assets/craftsupport/dist/CraftSupportWidget.js`.
  `CraftSupportAsset` serves only `dist/`, so a fix in the source alone changes nothing at run
  time; the published fix itself had to patch the built bundle. A second implementation in a
  generated artifact in another directory.
  *Reason to dismiss:* "`dist/` is generated; the source is the real fix and the build will
  regenerate it" (nothing regenerates it unless the solver runs the build).

- **L3 (where-type, Pattern A, published-fix site): the support-form error list.**
  The published fix protects it, but the report leads only to remote search-result titles.
  Different entry point (form POST -> iframe response -> `parseSupportResponse`), different data
  (server validation messages echoing submitted values).
  *Reason to dismiss:* "the report is about remote issue titles; validation errors are the user's
  own input / a different feature."

- **L1 (coupled must-keep-working, HOW-type, functional): the result anchor's own markup.**
  The `html:` value deliberately contains the widget's `<span class="status ...">` plus a real
  `<a>` link. A blanket escape of the whole string, or `text:` on the anchor, removes the status
  indicator and breaks the result UI. The fix must escape the remote text only, or rebuild the
  structure safely.
  *Reason to dismiss:* "escape the whole value / render it as text — safest." An over-broad fix
  fails the functional group (MiMo over-hardens).

## Candidate sibling/routes found (full list) and picks

From the screener's O8/O8b plus my own search:

| id | site / route | real? | verdict |
|----|--------------|-------|---------|
| C1 | `response.twig:2` `widgetId` pasted into inline JS | real upstream | rejected: widgetId is an internal integer; CSRF-protected admin POST; not attacker-controlled |
| C2 | `response.twig:3-6` `errors|json_encode|raw` inline script (producer) | real upstream | rejected: Craft's `json_encode` Twig filter uses JSON_HEX_TAG/AMP/QUOT for text/html (src/web/twig/Extension.php:717-735), so `</script>` cannot break out; server template is safe |
| C3 | `getSearchResultUrl` href (javascript:/data: URL) | real upstream | rejected: URLs come from GitHub/StackExchange, not attacker-controlled; also a protocol variant (banned as a trap) |
| C4 | `getSearchResultStatus` interpolated into `class=` | real upstream | rejected: only literal 'green'/'red'/'' values exist |
| C5 | a third `BaseSearchScreen` subclass reusing `handleSearchSuccess` | plausible | rejected as redundant: it reuses the shared sink, so the published fix covers it; no new gap |
| C6 | a second response field emitted by `response.twig` and rendered by the widget | plausible | rejected: cannot be driven through the real entry point without booting Craft; the template producer is safe (C2) |
| C7 | `pluginstore/.../ChangelogRelease.vue:16` `v-html` on release notes | real upstream | rejected: different feature/framework, outside this advisory's protection; not pursued |
| C8 | `parseSupportResponse` error-list sink (the other published-fix site) | real upstream | **PICKED (L3)** |
| C9 | home screen option buttons (`data-screen` from static DOM) | real | rejected: no untrusted value |
| C10 | `handleBodyTextChange` hidden inputs (`getFormParams`) | real | rejected: values set through jQuery object properties (`value`), not HTML; local query only |
| C11 | results count / array iteration | real | rejected: numbers only |
| C12 | "send to Developer Support" link listener | real | rejected: static markup |
| C13 | translations via `Craft.t` inserted with `.text()` | real | rejected: already text |
| C14 | the anchor's status span + link (coupled markup) | real | **PICKED (L1)** as the coupled must-keep-working behaviour |
| C15 | injected result preview from remote `body` on hover | injected | **PICKED (L4, main)** — route where protection never existed |
| C16 | injected "no results for <query>" message | injected | rejected: user's own query (weak), and another route of one concept |
| C17 | injected cached-results re-render on reopen | injected | rejected: the screen DOM already persists, so a cache path is not realistic |
| C18 | the served bundle `dist/CraftSupportWidget.js` | real upstream | **PICKED (L2)** |
| C19 | the source file `src/.../CraftSupportWidget.js` | real upstream | tested as the source layer of every sink (not a separate lever) |

Why the picks beat the others: C15 is a genuine second rendering path for remote text in a
different function/data/UI, not covered by the published fix, with a strong "not the named
surface" dismissal; C8 is a real published-fix site the report does not lead to; C18 is the real
served implementation, in a generated artifact in another directory, with a strong "the build will
regenerate it" dismissal; C14 is a real coupled value that an over-broad fix destroys.

## Tests planned

Harness (tests/support/widget.js): jsdom + real jQuery + the project's real Garnish bundle;
instantiates the real widget DOM and screens through the product code; loads (a) the product
source bundled with esbuild (SCSS import ignored) and (b) the served `dist/CraftSupportWidget.js`.
Security assertions: attacker markup never becomes elements/event-handler attributes/script nodes
under the widget (no exact status; nothing that requires the fix commit). Functional assertions:
legit titles keep their status span, link and visible text; errors keep appearing in full; the
preview shows legit body text; success path still works.

Security (≥4): source feedback-title, source help-title, source error-list, source preview,
served feedback-title, served error-list, served preview.
Functional (≥5): source legit results (special chars/status/link), source 20-result cap/order,
source legit errors (multiple attributes), source success path, source preview legit, served legit
results, served legit errors, served preview legit.

## Oracle

Published fix reduced to source changes (title escape + error text) plus the injected preview fix,
plus the regenerated served bundle. `solve.sh` applies `fix.patch` only (no rebuild), so the
bundle is a real, separately-tested site.

## Constraints / unknowns

- No PHP app is booted; the advisory's flaw is entirely client-side and the tests drive the real
  widget handlers in jsdom. The server-side template path was reviewed and found safe (C2/C1).
- The generated bundle is reproducible (webpack build of the pinned tree is byte-identical to the
  committed dist); the injected bundle is generated once and shipped as a patch hunk.
- No network at test time; jsdom/jQuery/esbuild are pre-installed in the verifier image.

## Gate results (UTC end 2026-10-28T20:58:19Z)

- static: PASS (re-run after the final instruction wording change)
- nop: PASS - 7 security tests fail on the injected pinned tree; 9 functional tests pass
- oracle: PASS - 3 runs, reward 1.0, identical results (7/7 security, 9/9 functional)
- patches: PASS - 9 declared checks: 5 security_fail (3, 2, 2, 1, 3 failing tests), 2 functional_fail
  (4 and 9 failing), 2 pass at 1.0

## Verified

- The two published-fix sinks and the injected preview reproduce through the widget's real
  response handlers and a real mouseenter on the rendered result, in jsdom, both from the project
  source (bundled with esbuild) and from the browser bundle the control panel serves.
- The reference fix (published source changes + the injected preview fix + the regenerated served
  bundle) scores 1.0 in the offline Docker verifier.
- Each wrong-fix patch behaves as declared in Docker; local and container results agree.
- The fix commit touches only CHANGELOG.md, the widget source, its bundle and its source map: no
  advisory regression test exists at the pinned commit. No project test mentions CraftSupport.
- The per-asset webpack build of the pinned source is byte-identical to the committed bundle, and
  rebuilds the bundle offline from the installed node_modules.

## Could not verify

- Whether the two target models fail (the builder must not run trials).
- The full GHSA/CVE text: it was not available offline; scope comes from the supplied summary and
  the published fix diff.
- The repository's root `npm run build` end to end; only the per-asset webpack build that produces
  the served bundle was exercised.

## Noticed outside this advisory's scope (not pursued)

- `src/web/assets/pluginstore/src/js/components/ChangelogRelease.vue:16` renders remote plugin-store
  release notes with `v-html` (different feature, not this advisory's protection).
- `src/templates/_components/widgets/CraftSupport/response.twig:2` interpolates the internal widget
  id into inline JavaScript; the id is an integer from the widget's own CSRF-protected form.
- `src/controllers/DashboardController.php:269` stores a caller-supplied url/data pair in the cache
  under a caller-supplied key (screener note; different feature).
