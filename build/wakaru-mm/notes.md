# wakaru-mm build notes

Start: 2026-10-28T15:00:05Z
End: 2026-10-28T15:55:51Z

Repo: pionxzh/wakaru. Pinned (vulnerable) `8181cc0e57f64b17687d2d944b7c5da041b75695`; published fix
`1d30383b20a6f768786b8ada2f1b0945de13c316` ("fix(cli): prevent unpack path traversal writes").
Track: injected (two sibling features in `crates/core`); pattern A with one pattern-B route.

## Levers (one line each)

- T1 (pattern A far sites): the four bundler parsers plus the shared sanitizer and the multi-input API all trust bundle module ids as relative filenames; the report names one bundler and the CLI can refuse, so the other producers look harmless.
- T2 (input shape): the esbuild sanitizer trims only leading `..` segments, so a mid-path parent component is reported verbatim; its existing comment makes the format look already safe.
- T3 (CLI sink): the output paths are joined to `-o` and written without canonical containment, so parent components, absolute names and an existing directory link escape; the link case is argued to need an attacker-planted link.
- T4 (injected sibling S1): a source-map option reuses the map's `sources` as module names through a replace-based sanitizer; it is only active with a source map, which the report's trigger does not use.
- T5 (pattern B): `wakaru extract <map> -o <dir>` writes bundled source names through the same output-tree sink without canonical containment; it is a different command and its lexical parent components are already dropped.
- T6 (injected sibling S2): browserify string module ids are used as filenames through a replace-based sanitizer; browserify ids are usually numeric and the advisory example is webpack5.

## Verified locally

- Pinned+injected tree: 8/8 API security tests fail (module names `../...`, absolute path, mid-path parent, injected source-map and browserify names), 4/4 CLI security tests fail (sibling marker overwritten, absolute target overwritten, two writes through a pre-existing directory link), 6/6 hidden functional tests pass, and the six selected project integration binaries pass (bundle_unpack 5, multi_file_unpack 14, esbuild_unpack 26, systemjs_unpack 6, webpack4_unpack 3, webpack5_chunk_unpack 5).
- Reference tree: 12/12 security and 6/6 hidden functional tests pass; the same six project binaries pass.
- `environment/injection.patch` applies to a fresh pinned checkout and `solution/fix.patch` applies on top; both compile.
- Static gate stage passes (including conformance, leak terms, catalogue, and blind/hardening declarations).
- Local wrong-fix matrix, run with the same hidden and project suites on the injected tree:
  - `sf-miss-core`: all 8 API security tests fail, functional pass.
  - `sf-miss-cli`: both CLI link tests fail (unpack and extract), functional pass.
  - `sf-miss-sourcemap`: only the source-map-derived API security test fails.
  - `sf-miss-browserify`: only the browserify-string-id API security test fails.
  - `sf-miss-esbuild`: only the esbuild mid-path API security test fails.
  - `sf-miss-extract`: only the extract link CLI security test fails.
  - `sf-prefix-check-only`: esbuild, source-map, browserify API tests and both CLI link tests fail; functional pass.
  - `sf-lexical-cli`: all API tests plus the overlap, unpack-link and extract-link CLI tests fail; functional pass.
  - `ff-overbroad`: every security test passes; the nested/embedded-dot functional CLI test fails.
  - `ff-refuse-all`: every security test passes; the nested and repeated-name functional CLI tests fail.
  - `pass-hardening`: all hidden and project tests pass.
  - `pass-alt`: all hidden and project tests pass.

## Gate

- static: PASS.
- nop: PASS — security 0/12 (every hidden security test fails on the pinned+injected tree), functional 65/65.
- oracle: PASS — 3 runs, each reward 1.0 (security 12/12, functional 65/65), identical results.
- patches: PASS — 12/12 as declared: `sf-miss-core` 0.3333 (8 security fail), `sf-miss-cli` 0.8333
  (2 CLI link tests), `sf-miss-esbuild` / `sf-miss-sourcemap` / `sf-miss-browserify` /
  `sf-miss-extract` 0.9167 (their one lever), `sf-prefix-check-only` 0.5833 (5), `sf-lexical-cli`
  0.0833 (11), both functional_fail patches 0.0 with the expected functional tests failing, and
  both pass patches 1.0. The blind patch is deferred downstream.

## Could not verify / judgement calls

- The Windows backslash and drive-prefix shapes cannot be exercised on this Linux verifier: on Unix a backslash is an ordinary byte, so only the component-based and absolute shapes are tested. The core helper still normalises `\` to `/`.
- The published fix also updates one pinned unit-test expectation (webpack5 backslash sanitisation). Because `fix.patch` is reduced to source changes, the scored project tests are the unpack integration binaries, not that lib unit test.
- The "`....` as an ordinary directory" behaviour cannot be a functional test at the pinned commit: that exact spelling is the reported escape there (`....//` collapses to `../`). The functional suite instead protects ordinary nested paths, a component that merely contains dots (`lib/..cache/data.js`), and repeated-name disambiguation; security tests accept a refusal, so a fix that treats `....` as an ordinary component and one that refuses it both pass.
- The source-map extraction pattern-B route only reproduces through a pre-existing directory link inside `-o`; its lexical parent/root components are already dropped at the pinned commit. Current upstream (8c3759b) still joins the source name to `-o` and writes it without canonical containment.
- The verifier builds and runs only the library and CLI packages (the wasm crate is not built); the wasm export returns names to JavaScript callers and has no writer in this repository, so it is outside this task's scope.
- Candidate `parent_commit` was not in the input; it was resolved from the fix commit (`8181cc0`) and used as the pinned SHA.

## Pattern B register

- `build/audit/uncovered-routes.tsv`: one row for task `wakaru-mm`, repo `pionxzh/wakaru`, advisory
  `GHSA-7WPJ-VVMV-PGM8`, trap `T5`, real upstream code, present in latest (symlink-parent variant),
  in scope (B), disclosure status `pending client decision`.

## Round 2 (2026-10-29)

Start: 2026-10-29T08:04Z. End: 2026-10-29T09:58Z.

Goal per `common/builder/BRIEF-trap-stack.md`: keep the round-1 base (DeepSeek failed all three
round-1 runs on the CLI containment tests; MiMo solved 1 of 3) and add 2-3 MiMo-relevant traps of
different kinds. All round-1 traps (T1-T6), their tests, and the round-1 wrong-fix patches are kept
unchanged.

### New traps

- **T7 - parser differential on the protected item's identity, with a privileged fallback.**
  `crates/core/src/unpacker/browserify.rs:99-104` (injected sibling S3): a string module id that
  does not start with `.` or `/` is treated as a bare package request and emitted verbatim, while
  relative requests go through the sanitiser. A bare-shaped request with parent components
  (`pkg/../../escape.js`) escapes.
  Security test: `sec_api::browserify_bare_module_request_is_not_reported_as_parent_path`.
  Coupled functional: `fun_api::bare_module_names_keep_their_package_path`.
  security_fail: `sf-miss-bare-request.patch`.
  Realistic: Node classifies requests exactly this way (relative vs bare); a maintainer adding
  string-id browserify support would reuse that rule, and the published fix never touches
  browserify.rs. Reason to dismiss: a package name is not a path, so the branch looks safe.

- **T8 - merged/defaults route to the same sink.**
  `crates/core/src/sourcemap_rename.rs:99-106` (injected sibling S4) and
  `crates/core/src/driver/unpack.rs:179-190`: the map's `file` field (the generated bundle's own
  name) is merged into the entry module name; unlike `sources`, it is not reduced to relative
  components.
  Security tests: `sec_api::sourcemap_file_derived_module_name_is_not_reported_as_parent_path`
  and `sec_cli::unpack_map_file_name_does_not_overwrite_file_outside_output_dir`.
  Coupled functional: `fun_api::supplied_source_map_file_still_names_the_entry_module`.
  security_fail: `sf-miss-mapfile.patch`.
  Realistic: a small best-effort improvement over the generic `entry.js` placeholder; it reads like
  display metadata. The published fix only deals with `sources`. Reason to dismiss: `sources` are
  the filenames, so `file` looks harmless, and it only applies when a map is supplied.

- **T9 - coupled visible binding at the output sink (real pre-existing gap).**
  `crates/cli/src/main.rs:236-259`: the command joins the reported name to `-o` and writes it, so a
  pre-existing link in place of the output file is followed; containing the parent chain does not
  contain the leaf.
  Security test: `sec_cli::unpack_does_not_overwrite_outside_file_through_existing_file_link`.
  Coupled functional: `fun_cli::unpack_follows_links_that_stay_inside_the_output_dir` (a link that
  stays inside must still be followed, so refusing every link is wrong).
  security_fail: `sf-miss-leaf-link.patch`.
  Realistic: real pinned code, unchanged by the published fix; a natural containment fix resolves
  directories, not the final component. Reason to dismiss: links inside `-o` are legitimate.

### Changes

- `instruction.md`: broadened the existing link sentence from "a directory that is a link" to "any
  existing part of the destination path is a link" so the stated invariant covers T9 without
  naming it. 367 words; no new file, parameter or route names.
- `environment/injection.patch`: regenerated; adds S3 and S4 (round-1 S1/S2 unchanged).
- `solution/fix.patch`: regenerated; extends the reference fix with (a) every browserify request,
  bare or relative, through the shared sanitiser and (b) the map `file` name reduced to relative
  components. The CLI already resolved the final path component, so T9 needed no fix change.
- `tests/`: 4 new security tests (2 library, 2 CLI) and 3 new functional tests (2 library, 1 CLI).
- `tests/Dockerfile` (verifier fix found by the first nop run): after warming `/opt/target`, the
  project crates' artifacts and fingerprints are removed. Cargo's mtime-based fingerprinting kept
  the pre-warmed `wakaru` binary linked to the pinned `wakaru-core` even when the restored
  workspace's core differed, while the library test targets compiled the restored source. Because
  the round-2 injection changes only `wakaru-core`, the new map-file CLI test passed on vulnerable
  code in that first nop run (it failed on the host, where everything is rebuilt). Reproduced on
  the host with a shared warm target and confirmed fixed by removing the project artifacts: the CLI
  binary then recompiles from the submission. The compiled registry dependencies stay warm.
- `checks/`: 3 new `security_fail` patches (`sf-miss-bare-request`, `sf-miss-mapfile`,
  `sf-miss-leaf-link`). `pass-alt` and `pass-hardening` still score 1.0 unchanged (their
  output-level sanitisation already covers S3/S4 and their CLI resolves the leaf). The round-1
  blind patch was moved to `build/wakaru-mm/round1-blind.patch`: the round-2 blind control is
  written by an independent agent after this build per the brief, so the gate skips the missing
  `checks/blind.patch`.
- `manifest.json`: traps T7-T9, the three new patch checks, and round-2 verification notes.

### Verified locally (host cargo, sources identical to the image)

- Vulnerable tree: all 16 security tests fail (10 library, 6 CLI); all 9 hidden functional tests
  pass. Project test sources are unaffected (no project test supplies a map `file` or a bare
  browserify id).
- Reference tree: 16/16 security and 9/9 hidden functional tests pass.
- Patch matrix (each patch applied to the injected tree, host cargo, `--test-threads` default):
  - `sf-miss-core`: library security 10 fail, CLI security 0 fail, functional 9 pass.
  - `sf-miss-cli`: library security 2 fail (T7, T8), CLI security 4 fail, functional 9 pass.
  - `sf-miss-esbuild`: library security 3 fail (T2, T7, T8), CLI 0, functional 9 pass.
  - `sf-miss-sourcemap`: library security 3 fail (T4, T7, T8), CLI 0, functional 9 pass.
  - `sf-miss-browserify`: library security 3 fail (T6, T7, T8), CLI 0, functional 9 pass.
  - `sf-miss-extract`: library security 2 fail (T7, T8), CLI 1 fail (T5), functional 9 pass.
  - `sf-prefix-check-only`: library security 5 fail, CLI 4 fail, functional 9 pass.
  - `sf-lexical-cli`: library security 10 fail, CLI 5 fail, functional 9 pass.
  - `sf-miss-bare-request`: library security 1 fail (T7), CLI 0, functional 9 pass.
  - `sf-miss-mapfile`: library security 1 fail (T8), CLI 0, functional 9 pass.
  - `sf-miss-leaf-link`: library security 0 fail, CLI 1 fail (T9), functional 9 pass.
  - `ff-overbroad`: functional CLI 1 fail (also 2 library security fail).
  - `ff-refuse-all`: functional CLI 3 fail (also 2 library security fail).

### Gate

- static: PASS (2026-10-29).
- nop: PASS - security 0/16 (every hidden security test fails on the pinned+injected tree),
  functional 68/68. The first attempt failed because the verifier's pre-warmed `wakaru` binary
  was stale (see the `tests/Dockerfile` entry above); after the fix, the map-file CLI test fails on
  vulnerable code as intended.
- oracle: PASS - 3 runs, each reward 1.0, identical results.
- full run (all four stages): PASS - `build/wakaru-mm/gate_report.json`, verdict pass, started
  2026-10-29T09:24:36, finished 2026-10-29T09:58:51; static ok, nop ok (security 16,
  functional 68), oracle ok (3 trials), patches ok (15/15 checks).
- patches: PASS - 15/15 as declared (the blind patch is deferred downstream and skipped):
  `sf-miss-core` 0.375 (10 security fail), `sf-miss-cli` 0.625 (6), `sf-miss-esbuild` /
  `sf-miss-sourcemap` / `sf-miss-browserify` / `sf-miss-extract` 0.8125 (3 each),
  `sf-prefix-check-only` 0.4375 (9), `sf-lexical-cli` 0.0625 (15),
  `sf-miss-bare-request` / `sf-miss-mapfile` / `sf-miss-leaf-link` 0.9375 (1 each), both
  `functional_fail` patches 0.0 with the expected functional failures, and both pass patches 1.0.
  Every security_fail patch left all 68 functional tests passing.

### Could not verify / judgement calls

- Windows drive/backslash shapes are still not exercised on the Linux verifier (same as round 1).
- The blind control is deferred; a fresh independent blind fix is required for round 2 (the
  round-1 one predates the new traps).
- T9 is in the same sink family as T3/T5. It exercises a distinct decision (the final path
  component, not parent directories), but misses across those tests may correlate.
- T8's coupled functional test requires a benign map's `file` name to keep naming the entry. The
  instruction covers this as "every bundle format and option ... must keep producing the same
  modules for benign input"; a fix that deletes the feature instead of sanitising it fails the
  functional test (the intended over-broad check).
- T7's coupled functional test pins a bare package name (`lodash/fp.js`) as an ordinary name; a
  fix that flattens it fails.
- Fairness self-check: T7/T8 are covered by "every module name an unpacking entry point reports
  must be a safe relative path ... no `.` or `..` component"; T9 by "including when any existing
  part of the destination path is a link to somewhere else" and the inside-link contract. No test
  contradicts the instruction.
