# mjml-s3 build notes

Start (UTC): 2026-10-27T13:48:15Z
End (UTC): 2026-10-27T14:33:30Z

Advisory: GHSA-4hch-r9xf-6vfr / GHSA-45h5-66jx-r2wf (mjmlio/mjml, path traversal in
`mj-include` resolution). Pinned vulnerable commit `21034a7187f2bda4b0d66e7a1c63314c88dce71a`.
Published fixes `30e29ed2cdae` (expose `ignoreIncludes` on `mjml2html`) and `517b376b068e`
(default includes off, realpath containment, CLI opt-in). The 2026 diff does not apply to the
2020 tree: it edits `handleCssHtmlInclude`, which does not exist at the pinned commit, and its
core hunk targets the async 5.x entry point. Treated as a behaviour specification, not a patch.

Track: injected. Pattern A+B.

## The property (written once, before routes)

Processing a document must never read, embed or reproduce a file outside the directory tree that
contains the document — for any path written in the document, at any embedding depth, and for
every public way the product is asked to process a document. The tree is the document's own
directory (the input file's location, or the directory the caller gives for the document).
Legitimate in-tree embedding keeps working, including references resolved from an embedded file's
own location and references that climb to a sibling directory still inside the tree.

Every security test below falls under that sentence as written. The instruction never names a
route, a mode, a package, a function or either injected feature.

## Levers

1. **Reported sink (pattern A, `flat_include`)** — `handleInclude` resolves the attribute against
   the document directory and reads it with no containment (`packages/mjml-parser-xml/src/index.js:69`
   at the pinned commit). Absolute and relative-climbing paths render outside content. Reason to
   dismiss: none; this is the reported one.
2. **Nested boundary (how-type, `nested_root`)** — the nested parse re-derives its resolution base
   from the included file's own directory (`index.js:106-113`). A naive containment keyed on the
   parser's `cwd` shrinks the boundary to each partial and refuses a legitimate `../shared/x.mjml`
   that is still inside the project. Reason to dismiss: "an embedded file's own directory *is* the
   project root for that parse" / never exercising a reference that climbs inside the tree.
3. **Resolved vs lexical path (shape, `symlink_target`)** — a link inside the project whose real
   target is outside. A `path.resolve` + prefix check passes the reported cases and still reads
   outside. Reason to dismiss: "the path is inside the project".
4. **Checking route (pattern B, `check_route`)** — `mjml -v` parses with `MJMLParser({ components })`
   directly (`packages/mjml-cli/src/client.js:196`), bypassing the compile wrapper. Real,
   unmodified upstream code; the published fix never touches it. Reason to dismiss: checking only
   produces diagnostics, never rendered HTML; "not the reported disclosure".
5. **Static partials (injected, `static_partials`)** — a separate reader
   (`packages/mjml-parser-xml/src/helpers/rawInclude.js:10`) reached from an `mj-include` that
   selects static content, embedding the file verbatim without parsing it. Documented in
   `doc/components_2.md`. Reason to dismiss: a different content kind / an opt-in feature, not the
   MJML include reader.
6. **Raw file source (injected, `raw_src`)** — `mj-raw` accepts a file source and reads it in a
   different package (`packages/mjml-raw/src/index.js:19`), after parsing. Documented in the
   package README. Reason to dismiss: raw asset embedding, not an include.

At least two levers have different reasons to dismiss (2/3/4/5/6). The main lever is how-type
(2: the fix must separate the resolution base from the containment root, and 4: the check must sit
at the shared sink, not the public compile wrapper).

## Coupled must-keep-working behaviour

* In-project reference renders (both API and CLI).
* Nested reference written from the partial's own directory renders.
* Nested reference climbing to a sibling directory inside the project renders (breaks the naive
  per-parse root).
* Both static-partial kinds embed in-project content.
* `mj-raw` reads an in-project file.
* The project's own parser fixtures (9 units, including its Include fixture) are unchanged.

## Design decisions

* Includes stay **on by default**; the fix is containment plus a realpath comparison. The 2026
  upstream default flip, and the CLI `allowIncludes` opt-in that it requires, are therefore not
  part of this task: under this contract they would break the documented default and the project's
  own Include fixture. The oracle still forwards `ignoreIncludes` from the compile API (the 4.6.3
  fix) but no test names or depends on that option, because it is undocumented at this commit.
* Oracle: root computed once from the document's directory, `fs.realpathSync` on root and target,
  root forwarded through nested parses; the same guard is applied to the static reader and to the
  raw element. Missing inside targets fall through to the usual "fails to read" node.
* Out of scope, not built on (one line each): `skeleton` option `require()` of an arbitrary path
  (`packages/mjml-core/src/index.js:36-44`, code loading); `.mjmlconfig` `packages` `require()`
  (code loading); watch-mode dependency scanner (`fileContext.js:41`, reads for a watch list and
  emits no rendered output; also hard to drive deterministically).

## Candidate sibling sites considered

Real upstream code:
* R1 CLI validate route (`client.js:196`) — **picked** (lever 4).
* R2 watch-mode `fileContext.js` reader — rejected: no rendered output; chokidar timers make a
  behavioural test flaky.
* R3 nested `cwd` re-derivation (`index.js:106`) — **picked** as the coupled functional lever 2.
* R4 `mjml2html` drops `ignoreIncludes` (`mjml-core/src/index.js:99`) — rejected as a tested lever:
  the option is undocumented at the pinned commit, so the report would have to name an interface
  users cannot see; it is only a wrapper for a default that this task deliberately keeps on.
* R5 `.mjmlconfig` options merge (`mjmlconfig.js`, core `index.js:52-64`) — rejected: configuration,
  not submitter-controlled.
* R6 `createComponent.renderMJML` hardcodes `ignoreIncludes: true` — already safe, no gap.
* R7 `mjml-migrate` passes `ignoreIncludes: true` — safe.
* R8 `skeleton` `require()` — different vulnerability, out of scope.
* R9 `.mjmlconfig` `packages` `require()` — code loading, out of scope.
* R10 CLI `-r` input reader — reads the user's own input, not embedded content.
* R11 `preprocessors` — caller code, not a sink.
* R12 `actualPath`/circular bookkeeping — no filesystem read.

Injected candidates:
* I1 explicit static partials in the parser, separate helper — **picked** (lever 5).
* I2 `mj-raw` file source, separate package — **picked** (lever 6).
* I3 directory-of-partials include — rejected: contrived feature and ambiguous semantics.
* I4 include-content cache ahead of the check — rejected: an attacker cannot seed the cache with
  an outside path; contrived.
* I5 document-level include pre-expansion in core — rejected: duplicates the parser and changes
  output semantics; too large to look like leftover code.
* I6 configured partials search path — rejected: moves the boundary into configuration and makes
  the allowed root ambiguous (unfair).
* I7 legacy `file=` alias — rejected: pure spelling variant; the prompt forbids those.
* I8 separate head-only include reader — rejected: overlaps the existing head handling and needs
  an artificial routing rule to be distinguishable.
* I9 `renderMJML` re-enabled includes — rejected: reachable only if application code passes
  attacker input to a custom component; unfair.
* I10 watch-mode config re-merge — covered by the parser-level fix; not a separate sink.

Why I1/I2 beat the rest: they are independent reads (different files, one in a different package),
each reachable through the real compile entry point, each needs its own guard to be fixed, each is
documented as a feature (so removing it violates the stated preservation clause), and each is
dismissed for a different reason. The rejected injected candidates were either unfair (I6, I9),
contrived (I3, I4, I5), or spelling/duplicate variants (I7, I8).

## Verified

Container gate (Harbor, real images, offline verifier), run stage by stage:
* `static` — PASSED.
* `nop` — PASSED: 0/10 security tests pass on the untouched pinned+injected tree, 16/16
  functional pass (reward 0.0).
* `oracle` — PASSED: 3/3 runs reward 1.0 with identical security and functional maps.
* `patches` — PASSED: all 12 declared checks behaved as declared. Security-fail patches and the
  security tests each leaves failing: miss_flat (api-absolute, api-symlink), miss_nested
  (api-nested-traversal), lexical_check (api-symlink), miss_validate (cli-validate), miss_static
  (api-static-css, api-static-html, cli-compile-static), miss_rawsrc (api-raw-src),
  crash_as_refusal (8 of 10), wrong_resource (6 of 10) — every one with 16/16 functional passing.
  Functional-fail patches: func_overbroad (api-nested-up), func_refuse_all (6 functional cases
  including the project's Include fixture). Pass patches: hardening and alt_fix both 26/26,
  reward 1.0.

Local (host, and inside the built Docker images):
* Vulnerability reproduces at pinned+injected through all reported forms (absolute, climbing,
  symlink, nested, static, raw source; API and CLI compile; CLI validate).
* Oracle: 10/10 security, 16/16 functional.
* Untouched pinned+injected: 0/10 security, 16/16 functional.
* Project tests at pinned+injected and with the oracle: `packages/mjml-parser-xml` and
  `packages/mjml-core` suites pass; the parser fixtures also run as hidden functional cases.
* Every check patch's declared outcome, run through the verifier image: miss_flat 8/10 (security
  fail), miss_nested 9/10, lexical_check 9/10, miss_validate 9/10, miss_static 7/10,
  miss_rawsrc 9/10, crash_as_refusal 2/10, wrong_resource 4/10 (all with 16/16 functional);
  func_overbroad 25/26 and func_refuse_all 20/26 (functional fails); hardening and alt_fix 26/26
  reward 1.0.
* Verifier flow simulated end to end in the built images with the artifact exclusions from
  `task.toml` (no node_modules, lib or .git restored): build from source, both groups, score.

## Could not verify

* `present_in_latest` for the injected features: the static-partial feature exists in current
  upstream in a different implementation, the raw file source does not; both are injected here,
  so "latest" only speaks to the upstream analogue.
* Whether Harbor's artifact collection preserves the exact exclusion semantics assumed above; the
  local simulation mirrors the documented behaviour.
* The 4.6.3 `ignoreIncludes` opt-out's real-world use: not tested by design (see above).
