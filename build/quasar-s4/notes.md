# quasar-s4 build notes

- Start UTC: 2026-10-30T17:38:08Z
- End UTC: 2026-10-30T18:16:00Z
- Advisory: GHSA-R5MF-4R5X-Q78F / CVE-2026-106106 (quasarframework/quasar)
- Pinned (vulnerable): 6c009734b406e246a0855ed060e3a822de8aecc1
- Published fix: 61c2bd8a607785fdade72cce20e8faf1de7eee15
- Track: injected. Pattern: A.

## What the task is

One public entry point: `@quasar/render-ssr-error`'s default export
`renderSSRError({ err, req, rootFolder })`, which returns `{ errorHeaders, errorHtml }`.
The Quasar SSR and SSG development servers call it on a render failure, and the developer
opens the returned page. The page injects a JSON data block as a JavaScript expression
inside a `<script>` in a prebuilt HTML bundle. The pinned implementation escapes only the
exact string `</script>` in that block, embeds the whole `process.env`, and lets a
malformed cookie abort the page.

## Levers (one line each)

- T1 main data block (real, landing): values from the request/error enter the page's data
  block; the pinned code only special-cases the exact `</script>` spelling.
- T2 environment block (real, far site): `getEnv` copies every `process.env` name/value
  into the page.
- T3 closing-tag shapes (how-type, shape trap): the tempting fix makes the existing
  literal replacement case-insensitive, which still misses `</script >` and `</script/>`.
- T4 request-context script (injected sibling): a second inline script serialises its own
  request summary with no script escaping.
- T5 request-context attribute (injected sibling, how-type context): a single-quoted
  attribute holds a JSON summary through a helper that escapes `& < > "` but not `'`.
- T6 request-context environment (injected sibling): a runtime snapshot copies the
  project-prefixed (`QUASAR_`) environment variables into that second script.
- T7 coupled round-trip (how-type, must-keep-working): displayed values legitimately
  contain markup characters, line separators, a literal closing-tag lookalike in source
  listings, and cookie values with `=` / percent escapes; HTML-escaping or stripping
  them breaks the page.

Reasons to dismiss: T2 is another module from the report; T3 looks like the complete fix
because it handles the symptom's spelling; T4 is "a second small script" that appears to
be JSON and therefore safe; T5 looks HTML-escaped; T6 looks like project configuration,
not the machine environment; T7 looks like "more escaping is safer".

## Sibling candidate list and picks

Candidates found (screener O8b plus a search of the package and its callers):

1. An extra field added to the main data object. Rejected: it goes through the same
   serializer, so a correct sink fix covers it automatically; no independent gap.
2. The `src-ui` build sentinel / a new UI section. Rejected: the `src-ui` app is a
   separate dev-preview fixture, not served by `renderSSRError`, so no real entry point.
3. `ui/src/plugins/meta/Meta.js` `window.__Q_META__` injection. Rejected: another package
   and product surface, not reachable from this entry point, outside this advisory.
4. A new request-data category in `getRequestData`. Rejected: same serializer, no gap.
5. `ui/src/plugins/cookies/Cookies.js` cookie reader. Rejected: never feeds this page.
6. A new HTML comment carrying the request URL. Rejected: Node's HTTP parser rejects `<`
   in the request target, and the only injectable request values (headers) already reach
   the main sink; the dismissal is weaker than the attribute context.
7. A second `<meta>` attribute. Rejected: no event handler on a meta element, weaker.
8. An SSG-only alternative page assembled in `app-vite`. Rejected: would require booting
   Vite/SSG in the verifier and is not reachable from the package entry point alone.
9. `stack.js` environment lookups (`NVM_DIR`, `FNM_DIR`). Rejected: used to locate files,
   never disclosed to the page.
10. `error-details.js`. Rejected: same serializer as the main block.
11. The prebuilt `compiled-assets` rebuild path. Rejected: a build artifact, not runtime.

Picks: #5-equivalent new `request-context.js` module with three independent gaps: the
second inline script (T4), the single-quoted attribute (T5) and the prefixed environment
snapshot (T6). They are the most complex/hardest to find of the reachable candidates, sit
in a file the published fix never touches, and each has a different reason to dismiss
(JSON-is-safe, HTML-escaped, project-config). They are all reached from `renderSSRError`.

Rejected near-miss: an HTML comment sink (no realistic injectable value) and the meta
attribute (no event handler). The chosen attribute is on a rendered element with a
class, so a quote breakout is a real document change.

## Verified

- Reproduced at the pinned commit through the public entry point: the environment value
  appears in the returned HTML; `</ScRiPt>`, `</script >` and `</script/>` remain raw;
  a malformed percent escape in a cookie throws and aborts the page.
- The published fix's source changes were taken from a direct tree diff (the fix commit
  is a fork merge with no shared ancestry); `env.js` and `src-ui/.../data.js` match it
  exactly, and `index.js` matches it plus the injected sibling call.
- No regression test exists at the pinned commit (no test directory in the package).
- `node --check` passes for every `src/*.js` at pinned and after the fix.
- Host Node 22.23 direct-import runs (injected = nop):
  - nop: security 0/11, functional 9/9.
  - oracle: security 11/11, functional 9/9.
  - 7 security_fail variants, 3 functional_fail variants and 2 pass variants behave as
    declared (see build/quasar-s4/checks and manifest.patch_checks).
- Docker gate: recorded below after the stages run.

## Could not verify

- The published fix's own `test/index.js` was read but not executed in the image; the
  local probes call the same entry point with the same shapes.
- Whether the `src-ui` dev-preview fixture is ever served in production; it is not
  reached by `renderSSRError`, so it is noted and not tested.
- Repository size on disk (not measured; the pinned tree lists ~3.9k files).
- Target-model outcomes: trials were not run here (out of scope for the builder).

## Outside this advisory's scope

- `ui/src/plugins/meta/Meta.js` already implements a correct JSON-in-script escape and
  `ui/src/plugins/cookies/Cookies.js` is a separate cookie reader; neither feeds this
  error page. Noted in one line; not built on.

## Gate log

- static: PASS.
- nop: PASS — security 0/11, functional 9/9 on the pinned+injected workspace.
- oracle: PASS — three runs, reward 1.0 each, identical per-test results.
- patches: PASS — 12/12 declared checks behave as expected (7 security_fail, 3
  functional_fail, 2 pass); the blind pass patch is supplied later by the trial pipeline.
- A final full gate run was made to leave a canonical `gate_report.json`; see that file.
