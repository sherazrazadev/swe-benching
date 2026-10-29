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
