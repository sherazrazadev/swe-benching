# swc-s4 build notes

- start: 2026-10-29T00:47:23Z
- end: 2026-10-29T02:10:00Z
- advisory: GHSA-5QR2-V392-M9G8 / CVE-2026-72925, swc-project/swc
- pinned (vulnerable): ad0e3b49bca3a61bc8f5ac90e15dc263b9cc674c
- published fix: e1877b44bdac8abc9fd51e984d584f40f6999832 (direct child of the pinned commit)
- pattern: B; track: injected; entry points: `minify_document`, `minify_document_fragment`

## Levers (one line each)

- **L1 json_script_text** (published landing, baseline): JSON script text is parsed and re-serialized
  with serde_json, which normalizes `<` back to a literal `<`, so the data can spell the
  element's end tag; where `crates/swc_html_minifier/src/lib.rs:2827-2851` (injected tree).
- **L2 js_end_tag_spellings** (real upstream, untouched by the published fix; how-type shape trap):
  the JS arm replaces only the exact lowercase `</script>`; HTML ends the element on a
  case-insensitive name terminated by `>`, `/` or whitespace, and the minifying code generator
  decodes `<` escapes and folds concatenation, so it synthesizes `</SCRIPT>` / `</script >`;
  where `crates/swc_html_minifier/src/lib.rs:2159`.
- **S1 structured_json_serializer** (injected, how-type second serializer): importmap and
  speculationrules get their own normalization helper that calls serde_json directly, so the
  general JSON arm's escape never runs; where `lib.rs:2736-2745` + `lib.rs:1852`.
- **S2 combined_data_blocks** (injected, how-type producer off the check's path): after the main
  pass escapes script text, a post-pass combines adjacent `application/json` array blocks and
  re-serializes them with serde_json, reintroducing the literal characters; where
  `lib.rs:1369-1425` and the call at `lib.rs:2624`.

Reasons to dismiss: L1 is the reported sink. L2 reads as a different, already-guarded feature (the
comment even says the guard is a TODO for codegen). S1 reads as a neighbouring feature's fast path
for two fixed-shape script types, and the generic arm looks like it covers them. S2 reads as the
metadata-merge optimization and is far from the reported sink.

## Candidate list before choosing (everything found)

Real upstream:
1. JSON text arm (`MinifierType::Json`) - the published landing. Chosen (L1).
2. JS text arm exact-case replace - real, untouched. Chosen (L2). Confirmed behaviourally:
   `</SCRIPT>` and `</script >` survive into the output; `</script>` is rewritten.
3. JS module arm - same replace; chosen as an input shape of L2 (needs a side effect because the
   module compressor drops unused declarations).
4. `merge_js` (metadata merge of adjacent JS scripts) - emits codegen output with no replace; not a
   distinct route: `visit_mut_text` re-minifies the merged text afterwards, and with `minifyJs`
   off the code generator preserves the raw escaped source, so nothing is synthesized. Rejected.
5. `MinifierType::Html` custom-type arm - not confirmed: probing an inner `<script>` through
   `minify_html` left the inner text unchanged (the nested minifier returned the input), so no
   synthesised terminator was produced. Rejected as unconfirmed.
6. JSON in attributes (`minifyAdditionalAttributes` -> json) - attribute values are quoted and `"`
   is escaped by the HTML code generator, so `<` inside the attribute creates no markup. Not a
   script sink. Rejected.
7. `srcdoc` attribute - a nested document whose JSON script is rewritten by the nested minifier;
   vulnerable but covered by the same published JSON escape. Kept as an input shape, not a lever.
8. template content, SVG-namespace script, `noscript`, document fragment - same JSON arm. SVG is a
   shape trap in its own right (foreign content parses the script text as markup, so escaping only
   `</` is not enough); kept as input shapes.
9. `merge_text_children` for JSON scripts - real upstream skips non-JS script types
   (`allow_elements_to_merge` sets `need_skip`), so there is no merge route today; it became the
   model for the injected S2.
10. CSS/style `</style>` terminator - the same class of bug on a different protected element. Out
    of this advisory's scope; not built.
11. `swc_ecma_codegen` `Config::inline_script` / `replace_close_inline_script` - a second
    implementation of the protection in another package, disabled by default and not reachable from
    the minifier as its own route; a valid fix layer, not a separate lever.
12. Invalid JSON is left untouched - safe: the HTML parser never puts a literal end tag into a
    script text node, and entities are not decoded in raw text.
13. Scripts with `src` are skipped; duplicate `type` attributes keep the first; both have no gap.
14. Bindings (`binding_html_node`, `binding_html_wasm`) wrap the same visitor - no separate logic.
15. Conditional-comment content: removed by default; not pursued after the probe dropped the
    comment.

Injected candidates considered before picking:
- post-visit JSON-block merge producer - chosen (S2), how-type, far from the landing.
- specialized importmap/speculationrules serializer - chosen (S1), second serializer, plausible
  fixed-shape fast path.
- JSONC comment stripping before serde_json - rejected: same arm, rescued by the arm escape.
- `application/ld+json` fast path duplicating `minify_json` - rejected: a near-copy (where-type).
- an attribute JSON escape - rejected: not a script sink.
- a CSS `</style>` guard - rejected: different protected element, out of scope.
- binding-layer post-processing escape - rejected: not offline-testable without a Node build.
- a guard in `merge_js` - rejected: re-minified afterwards, so not an independent route.

Why the picks beat the others: they are the only candidates that (a) are reachable through the
public entry point with plain documents/options, (b) create the same protected outcome (a script
element ended early), and (c) need the mechanism understood (a second serializer / a producer that
runs after the check), rather than only an extra search.

## Property

Stated once in `instruction.md`: no value the document carries, and no data the minifier produces
from it, may end the script element that holds it; re-parsing the output must keep the same script
boundaries and data and create no markup. Read literally it covers JSON, JavaScript, SVG/template
content, combined blocks and the specialized serializers, and it does not name any of them.

## Verified on the host (scratch clone, 4 CPUs)

- `cargo test -p swc_html_minifier` at the pinned commit: 249 passed.
- Pinned + injected tree: 249 passed; hidden suites: security 13/13 FAIL, functional 7/7 pass.
- Pinned + injected + oracle: 249 + 13 + 7 pass.
- Every wrong-fix variant was run through both hidden suites on the host (counts recorded in
  `checks/`): sf_no_json_escape 7 security fail; sf_no_js_escape 3; sf_no_merge_escape 1;
  sf_no_structured_escape 2; sf_crash 10; sf_input_check 7; ff_overbroad 2 functional fail;
  ff_refuse_all 7 functional fail; pass_hardening and pass_alternative all pass.
- An earlier alternative fix that escaped only `</` was rejected by the SVG-namespace security test
  (SVG foreign content parses the script text as markup, so a bare `<img` still creates an
  element); the alternative was replaced by a serializer-layer design.

## Verifier bug found by the first nop run, and the fix

The first nop run failed: 13/13 security tests failed (correct) but so did the two injected-feature
functional tests and all 249 project fixtures. The verifier build finished in 1.27s and reused the
warm artifacts from tests/Dockerfile's throw-away checkout (/tmp/warm), because the restored
/workspace sources carried older mtimes than those artifacts: the reused rlib was the pinned crate
(so the injected behaviour was missing) and the reused fixture executable embedded /tmp/warm paths
(so every fixture test failed once that checkout was deleted). Reproduced offline with the same
executable hashes as the gate log, then fixed by touching every `*.rs` under /workspace in
tests/test.sh before the build; the touched rebuild takes about a minute and then the pinned+injected
tree gives security 13 fail / functional 7 pass / project 249 pass, and the oracle gives 13/7/249
pass. Re-ran the nop stage after the fix.

## Guesses / not verified

- `present_in_latest` for the JS arm: read on 2026-10-29 from
  `raw.githubusercontent.com/swc-project/swc/main/crates/swc_html_minifier/src/lib.rs`, which still
  has `replace("</script>", "<\\/script>")`; no release tag was checked.
- The html-arm route (candidate 5) and the conditional-comment route were read and probed, not
  proven either way; neither is used.
- Exact Docker image build and Harbor trial behaviour are verified by the gate, not here.
- The wrong-fix patches are diffs against the injected tree; only the gate's own oracle runs prove
  each one applies to the image's checkout.

## Outside scope (not built on)

- The `</style>` breakout for CSS text is the analogous bug on a different protected element.
- `merge_text_children` concatenating adjacent JS scripts via the JS parser is data corruption, not
  a script-boundary breakout.

## Gate results (2026-10-29)

- static: PASSED (conformance, metadata, no leaks, no hidden-test content in environment/).
- nop: PASSED - 13/13 security fail on the pinned+injected tree, 256/256 functional pass
  (7 hidden + 249 project fixture/recovery), reward 0.0.
- oracle: PASSED - 3/3 runs reward 1.0, identical 13/13 security and 256/256 functional.
- patches: PASSED - 10/10. security_fail: sf_no_json_escape (7 security fail), sf_no_js_escape (3),
  sf_no_merge_escape (1), sf_no_structured_escape (2), sf_crash (10), sf_input_check (7); every
  one keeps all functional tests passing. functional_fail: ff_overbroad (2 hidden + 2 project
  fixtures), ff_refuse_all. pass: pass_hardening 1.0, pass_alternative 1.0.
- blind.patch and FAIRNESS.md are written later by the pipeline, not by the builder.

## Wrong-fix catalogue mapping

- refuse_all -> ff_refuse_all.patch; crash_as_refusal -> sf_crash.patch;
  check_after_adjustment -> sf_input_check.patch (guard on the input text, before the JSON
  serializer normalises unicode escapes); unlisted_route -> sf_no_js_escape.patch;
  adjacent_api -> ff_overbroad.patch (escaping every less-than sign in JavaScript output changes
  the sibling JS API's stated behaviour). wrong_resource, one_role_or_direction, reads_only,
  malformed_identity, missing_authority: n/a for this sink (no authority/role/name parsing).
