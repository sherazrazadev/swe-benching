# coraza-s4 — build notes

- Start: 2026-10-30T15:03:25Z
- End: (filled at the end of the build)
- Advisory: GHSA-3WR7-993Q-JRFF (corazawaf/coraza), CWE-436 / CWE-20 multipart
  Content-Disposition parser differential (RFC 5987 extended name vs plain name)
- Pinned: 146c2f79f39ad16f13787e7d67ad400f8d8cb9a3
- Published fix: 5427c501b2fea6ae1305903efef01b3049224a58 and b2a9264437116bdd98a86fe345b2aec1152d3d7c
  (cae3c740 in the same range is an unrelated JSON-recursion advisory and was not used)
- Track: injected; pattern: A

## Security property (one)

For every part of an uploaded body, every name a receiving application can use to identify the
part — the uploaded file's name and the form field's name — must be visible to the rule engine,
whichever header syntax expresses it; when a part declares several plausible readings, all must be
visible, and a declaration that cannot be interpreted consistently must surface as a malformed
multipart request. Unambiguous uploads keep exactly one reading and unchanged size accounting.

## Levers (one line each)

- T1 (main, how-type): the file-name reading. `internal/bodyprocessors/multipart.go:140-148`
  (pinned) returns only the stdlib's plain `filename`; `filename*` is decoded only for
  us-ascii/utf-8. Reason to dismiss: RFC 7578 says the extended name wins, so "prefer the extended
  name" looks complete — it hides the plain reading instead (`sf-miss-dual-reading`).
- T2 (where-type, published-fix far site): `MULTIPART_FILENAME` is declared
  (`internal/variables/variables.go:403-412`, `internal/corazawaf/transaction.go:246-248`) but never
  populated at the pinned commit. Reason to dismiss: its docs say "not implemented", so it reads as
  a separate feature request (`sf-miss-target`).
- T3 (pattern B, how-type): the form-field name comes from `p.FormName()` at
  `internal/bodyprocessors/multipart.go:51,101,117`, the same charset-restricted stdlib path; the
  published fix never touched it and upstream main (08aa5114, 2026-10-29) still does not. Reason to
  dismiss: the report is about the file's name; the field name reads as a grouping key
  (`sf-miss-fieldname`).
- T4 (injected, how-type, route where the protection never existed):
  `internal/bodyprocessors/multipart_nested.go` (added by `environment/injection.patch`, called from
  the field branch of the processor) parses container parts with its own `nestedOriginFileName`.
  Reason to dismiss: container-carried uploads are an uncommon client shape and the report's
  example is flat (`sf-miss-nested`).
- T5 (how-type): ambiguity signalling. At pinned `originFileName` swallows
  `mime.ParseMediaType`'s error, so a continuation, a malformed extended value or a duplicate plain
  name silently becomes a form field. Reason to dismiss: these read as parser edge cases no browser
  sends (`sf-miss-malformed`).

## Dependent-architecture note

The engine's rule targets are the whole product here: the fix has to reach `FILES`,
`FILES_SIZES`, `FILES_NAMES`, `MULTIPART_FILENAME` and `ARGS_POST`, and must raise
`MULTIPART_STRICT_ERROR` where a declaration cannot be resolved. The hidden tests observe all of
them through real rules on a WAF built from directives, driving the public transaction API.

## Injected-sibling candidates searched, and why the picks won

1. Part name parsed with `p.FormName()` (screener O8b #1) — CHOSEN as T3. Real upstream code,
   unmodified by the published fix, same header, same stdlib restriction; verified behaviourally
   on the pinned tree and still present upstream.
2. Container-carried parts with a second name-extraction copy — CHOSEN as T4 (injected). A
   different file and a different parse path; a maintainer adding multipart/mixed support would
   plausibly copy the old extraction; the published fix never touches the new file.
3. Exporting the parser through `plugintypes` for third-party body processors (O8b #3) — rejected:
   no third-party processor ships in the tree, so the gap is unreachable through a real entry point
   unless the test calls the helper by name (which would need a contract the instruction must
   spell out, pointing straight at it).
4. Audit-log Part J re-derivation (O8b #2) — rejected: Part J is built from `FILES`, not a second
   parser, and it is not visible to rules, so the property does not cover it.
5. `Content-Type`'s legacy RFC 2045 `name` parameter as a filename fallback — rejected: plausible
   code, but the shape (an extended `name*` inside `Content-Type`) is contrived and close to T3's
   concept.
6. `SecUploadKeepFiles` retention path — rejected: the sink would be a filesystem write, a
   different vulnerability class (path handling), outside this advisory.
7. Nested-container field names — rejected: a second route of T3/T4's concept, falls together with
   them.
8. Response-side or URL-encoded processors — rejected: no part-name derivation there.
9. `MULTIPART_PART_HEADERS` keyed by the part name — rejected: same value as T3, same parse.
10. `FILES_TMPNAMES`/temp-file naming — rejected: the engine picks its own random temp name.

Picks 1 and 2 are the only candidates that are (a) reachable through the normal public entry
point, (b) produce rule-visible name loss on the pinned tree, and (c) sit outside the published
fix. T3 is real upstream code; T4 is the injected sibling.

## Verified

- Pinned + injection: 14/14 security tests fail, 10/10 functional tests pass (locally and by
  running the suites in a clean copy created from the archive of the pinned commit plus
  `environment/injection.patch`).
- Reference fix (`solution/fix.patch`): 14/14 security and 10/10 functional pass; the project's own
  tests `go test ./internal/bodyprocessors ./http` pass.
- Alternative fix (`checks/pass-alt.patch`, independent parser, no changes to the variable plumbing):
  all 14 + 10 pass — the tests do not require the reference's shape.
- Every check patch was run locally against both suites: the five `sf-*` leave security failures
  with all functional passing, the two `ff-*` break functional tests, `pass-hardening` and
  `pass-alt` score everything.
- The T3 route is unmodified upstream: `p.FormName()` is still used in upstream main at
  08aa5114 (read-only fetch), with no extended-name handling.

## Could not verify

- The two target-model trials (not run here; the gate is the only proof available to the builder).
- `public_upstream_report` for T3: no public advisory was found that names the field-name variant;
  only the code was inspected.
- Whether every real backend resolves `name*` the way Werkzeug does; the property is stated over
  "a receiving application", and the test asserts the engine exposes both readings rather than
  picking a backend.

## Outside the scope, noted (not built on)

- `cae3c740` in the same commit range fixes an unrelated JSON response-recursion advisory
  (GHSA-3c6w-j9xm-8h2h); it is not part of this task.
- The request body processor is selected from the first `Content-Type` value, so duplicate
  `Content-Type` headers can make Coraza pick a different parser than a backend; outside this
  advisory's name property.
- `FILES` is stored under the empty key, so a ModSecurity-style `FILES:<filename>` selector does
  not match; not pursued.

## Gate results (run one stage at a time, 2026-10-30)

- static: PASSED (no warnings; the blind pass patch and FAIRNESS.md are written downstream).
- nop: PASSED — 14/14 security tests fail on the pinned+injected tree; 163/163 functional pass
  (10 hidden functional + 153 project-area testcases from `./internal/bodyprocessors ./http`).
- oracle: PASSED — 3 parallel runs, reward 1.0 each, identical per-test results.
- patches: PASSED 9/9 —
  sf-miss-dual-reading 0.1429 (12 security fail), sf-miss-target 0.8571 (2), sf-miss-fieldname
  0.8571 (2), sf-miss-nested 0.8571 (2), sf-miss-malformed 0.6429 (5) — all with functional
  passing; ff-refuse-all 0.0 (22 functional fail), ff-overbroad 0.0 (3 functional fail);
  pass-hardening 1.0, pass-alt 1.0.
- A single full run (`python3 -I common/gate/gate.py coraza-s4`, no `--only`) then PASSED all four
  stages in order and wrote the definitive `build/coraza-s4/gate_report.json` (passed: true).
- End: 2026-10-30T15:38:30Z.
