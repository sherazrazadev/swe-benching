# kit-s4 — build notes

- Start (UTC): 2026-10-29T17:14:38Z (pipeline start; work began 17:14Z).
- End (UTC): 2026-10-29T17:52Z.
- Advisory: GHSA-866W-XMHQ-WJ7X / CVE-2026-82257 — sveltejs/kit, CWE-1321.
- Pinned: 82790de5b87470a3cc7178bae2c322db62cf0a8e. Published fix: df32f6fe86cdd0b68b650e3e4631e5896453dcd3.
- Track: injected, pattern A+B. Delivery follows the current Frontier 1.4 template (separate
  verifier, /workspace, tests/Dockerfile), which supersedes the older `/app` wording in the prompt.
- The published fix was reduced to source changes (the changeset and the project's own new spec
  cases were dropped). Two maintained sibling routes were added by `environment/injection.patch`
  and fixed in `solution/fix.patch`.

## Levers (one line each)

1. **L1 (A, reported)** — an emptied single file control splits its name by hand and deletes the
   leaf, so a dangerous path part is never checked. `form.svelte.js:526-535`.
2. **L2 (B/how, shape)** — the dangerous part can sit in the middle of an ordinary, already-stored
   nested path (dotted and bracket spellings); a guard that checks only the first or only the final
   part lets it through. `form.svelte.js:526-535` with `form-utils.js:516-536`.
3. **L3 (B/how, coupled)** — removal must delete the leaf, must not create containers for a path
   that was never stored, and must not treat a legitimately stored `undefined` as removal. A
   tempting fix that stores `undefined` breaks all three. Coupled tests: functional/
   clear_nested_file, clear_indexed_file, clear_absent_path, stored_undefined.
4. **L4 (B/injected)** — the array form of a file control takes the same hand-rolled delete when
   its selection becomes empty; it reads as the multiple-file feature, not the reported clear.
   `form.svelte.js:503-514`.
5. **L5 (B/injected)** — the empty-value branch of the conversion that rebuilds stored values from
   submitted form data drops the field with the same hand-rolled delete; every other key in that
   loop still goes through the checked setter, so the branch reads as harmless.
   `form-utils.js:49-62`.

## Sibling candidate list and picks

Every candidate found (screener O8/O8b plus a search of the tree):

| # | candidate | verdict |
|---|-----------|---------|
| 1 | single-file clear branch `form.svelte.js` | reported (L1); real upstream |
| 2 | file-array branch `form.svelte.js` | **picked (L4)** — injected; same idiom, different feature, reachable on the input event |
| 3 | `convert_formdata` empty-value skip `form-utils.js` | **picked (L5)** — injected; same idiom, different concern, reachable from reset and from form-data ingest |
| 4 | server progressive-enhancement `handle_issues` loop | rejected — unreachable with a dangerous name: the form-data deserializer calls `convert_formdata` first, which already throws; a delete there would be dead code |
| 5 | binary ingress `deserialize_binary_form` (screener O8) | rejected — verified disproven: devalue 5.8.1 refuses `__proto__` keys on parse, and `constructor`/`prototype` keys never reach a nested-path write |
| 6 | client/server `fields` proxy setters | rejected — the path is developer code, not a submitted field name; they already route through the checked setter |
| 7 | `deep_clone` own-key copy | rejected — no attacker-controlled object with an own dangerous key reaches it; all input routes guard and devalue refuses `__proto__` |
| 8 | previous-submitter clearing in the submit handler | rejected — the submitter name is developer markup, not submitted input |
| 9 | `flatten_issues` accumulator | rejected — a name collision there throws rather than mutating a prototype (different protection, outside this advisory) |
| 10 | `split_path` regex tightening | not a sibling; it is one valid alternative fix (see `checks/alt.patch`-style reasoning) |
| 11 | `normalize_issue` / `create_field_proxy` issue lookups | rejected — no nested-path write or delete |

Why the picks beat the rest: 2 and 3 are the only candidates that (a) reach the protected sink
through the same real entry points, (b) are realistic maintained code a reviewer would read as
unrelated, and (c) the published fix never touches. Their dismissal reasons differ — "the array
feature is separate" versus "that branch only skips empty values and every real value is already
validated". The rejected candidates are either unreachable at the pinned commit or out of this
advisory's protection (no prototype mutation). No third injection was added: the handle_issues and
deep_clone routes are unreachable, and adding an unreachable sibling would be unfair noise.

## Verified

- Exploit reproduces on the pinned+injected tree through the framework's public form object
  attached to a real `<form>` with real DOM input/reset events: 12/12 security cases fail there.
- After the reference fix: 12/12 security cases pass and 62/62 functional cases pass.
- Every check patch produced its declared outcome locally and in the gate:
  `sf-miss-reported` (7 security fail), `sf-miss-array` (2), `sf-miss-convert` (3),
  `sf-miss-shape` (7), `ff-store-undefined` (6 functional fail), `ff-refuse-all` (7 functional
  fail), `hardening` and `alt` (all pass).
- The project's own `packages/kit/src/runtime/form-utils.spec.js` (47 cases) passes with pristine
  sources on the pinned+injected tree and on the reference fix.
- Gate stages were run one at a time (static PASS, nop PASS, oracle PASS, patches PASS), and after
  the final wording edit the full gate PASSED: static, nop, oracle (3 identical runs), patches
  (8/8 declared behaviours; the blind patch is left for the blindfix step).

## Could not verify

- Current upstream status of the injected siblings: they are our copies, so the register records
  `present_in_latest = no`; no later upstream tree was inspected for an equivalent route.
- The screener's binary-ingress lead was disproven only against the devalue version this project
  pins (5.8.1); a different parser version could behave differently.
- The harness stubs the framework's client router module (it needs the hydration/router machinery);
  the form runtime itself is the real product code, driven through real DOM events. This mirrors
  the project's own client unit-test setup.
- The test entry point is the browser-side form runtime, not a full Playwright-driven app (a
  browser install would make the verifier much heavier). No HTTP service is involved.

## Out of scope (noted, not built on)

- `form.svelte.js` interpolates a field name into a `querySelectorAll` selector in the same handler
  (a DOM-selector injection unrelated to this advisory's protection); not pursued.

## Pattern B register rows

Added to `build/audit/uncovered-routes.tsv`: `manifest.traps t3-emptied-file-array` and
`manifest.traps t4-rebuild-from-form-data` (real_upstream = no; both injected siblings, reachable
through the real entry point, built and gate-passed).
