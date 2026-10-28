# sublinear-time-solver-s2 — build notes

Start (UTC): 2026-10-27T22:23:57Z
End (UTC): 2026-10-27T22:51:38Z

## Candidate and advisory

- Repo: ruvnet/sublinear-time-solver, pinned 1210646955f33abe5c91f894cc7b04d024f62408
  (parent of both published fixes a701296e... and ea9a212b...).
- Advisory GHSA-XC9G-J69Q-37XW / CVE-2026-55609, CWE-73 (external control of file name/path).
- Track: injected. Pattern: A+B.
- Verified at the pinned commit, through the real MCP stdio surface: `export_state` writes a
  caller-named absolute path (overwrote a scratch victim), `import_state` reads one; main MCP
  `saveVectorToFile` writes a caller-named path; `solveTrueSublinear {vector_file}` reads one.
  Both published fixes are children of the pinned commit and touch disjoint trees
  (`src/consciousness-explorer/**` and `src/mcp/**`). The upstream regression test
  `tests/consciousness/safe-path.test.mjs` is absent at the pinned commit.

## One security property (written once, before choosing routes)

"No file name or path supplied by a client of an MCP server in this product — the file-name
argument itself, or any value the server turns into a file name or path — may make the server
create, overwrite or read a file outside the dedicated directory the feature reserves for that
data, including when the chosen name is a link that points elsewhere. A value that would take
the file outside the reserved area is refused as a client error that leaves no file or
directory outside the reserved area and changes no existing file."

Preservation clause: embedders of the SDK that persist state to a destination path they choose
keep writing/reading at that path (a coupled must-keep-working value).

## Levers (each with a different reason to dismiss/skip)

L1 (main, HOW-type — derived name / defaults route): injected session-snapshot tools in the
consciousness MCP server take a `session_id` (an identifier, not a path); the library derives
`<session_id>.json` by string concatenation and joins it into the snapshot directory. A check
on the reported `filepath` field never sees it. File:line (injected):
`src/consciousness-explorer/index.js` exportSessionSnapshot/importSessionSnapshot,
`src/consciousness-explorer/mcp/server.js` handlers. Reason to dismiss: the report and the
published fix talk about file-path arguments; a session id reads as opaque metadata.
Why how-type: the fix must understand the derivation and validate the value at the sink or the
boundary, not just the named file argument.

L2 (HOW-type — wrong object): injected `saveAnalysisReport` MCP tool in the main server takes
`file_name` and a `directory` subfolder. The write path is `join(reportsDir, directory, name)`;
a plausible check validates only `file_name` while `directory` is the path part that escapes.
Reason to dismiss: the folder looks like organisation metadata, and the obvious file argument is
validated. File:line (injected): `src/mcp/server.ts` handleSaveAnalysisReport/saveAnalysisReport.

L3 (Pattern A far site, where-type): the published follow-up fix protects
`src/mcp/server.ts` `saveVectorToFile` (write) and `solveTrueSublinear {vector_file}` (read) in a
second, separate MCP server tree. The report never describes it. Reason to dismiss: different
program, numerical plumbing, only `export_state` is named. This is an extra, not the main lever.

L4 (HOW-type — coupled must-keep-working): the SDK's state persistence methods are public and
are also used by host programs and the CLI with absolute paths. A basename-only rule in the
library (the published fix's shape) breaks them. Reason to skip: models copy the upstream
library-level fix and over-harden; MiMo tends to over-harden. The fix must place confinement at
the MCP boundary (or give the library an explicit trusted mode), while keeping O_NOFOLLOW on the
write/read.

Shape coverage on every site: absolute path, `../` traversal, a relative subpath with a
separator, a symlink planted at the final component (outcome clause), and the read direction as
well as the write direction. `.`/`..` is covered as a clean refusal (a functional test), not as
an escape. Leading-dot, control-character, oversize and Windows-reserved names are part of the
published contract but are not escapes on this platform, so they are deliberately not asserted
as security requirements: that would fail a property-correct fix which accepts them inside the
directory. Refusals must be clean client errors with no side effect (no crashed process).

## Coupled must-keep-working behaviours (functional)

- MCP export_state/import_state round-trip and overwrite of an existing state file.
- SDK `ConsciousnessExplorer.exportState/importState` to an absolute path chosen by the embedder.
- save_session_snapshot/load_session_snapshot round-trip with a safe identifier.
- saveVectorToFile + solveTrueSublinear{vector_file} round-trip (JSON).
- saveAnalysisReport with an empty and a named subfolder.
- No project test covers the affected area at the pinned commit. `tests/unit/solver.test.cjs`
  imports no product code (an in-file mock), and `tests/integration/mcp.test.cjs` already fails
  3/21 at the pinned commit, so neither is used as a regression guard.

## Every candidate sibling site/route found, and why the picks beat the rest

Real upstream sinks/routes (searched `writeFileSync/readFileSync/createWriteStream/path.resolve`):
1. src/mcp/server.ts saveVectorToFile — PICKED (L3): published far site, second implementation.
2. src/mcp/server.ts vector_file read — PICKED (L3, read direction of the same far site).
3. src/consciousness-explorer/bin/cli.js verify --export — DROPPED: operator CLI flag, not an
   MCP client value; the property is about client-supplied values; also a published-fix-free
   operator surface, not a client boundary.
4. src/consciousness-explorer/lib/proof-logger.js exportProof — DROPPED: no in-repo caller
   (unreachable through a real entry point).
5. src/cli/index.ts --output — DROPPED: operator CLI flag.
6. src/neural-pattern-recognition/cli/index.js --output — DROPPED: operator CLI flag; also the
   screener already recorded it out of scope.
7. dist/mcp/server.js — DROPPED: generated output; the verifier rebuilds dist from src.
8. consciousness-explorer bin/cli.js export/import <filepath> and
   examples/psycho-symbolic-integration-test.js — not a security route (operator/SDK), but
   evidence for the coupled L2 value.
9. /tmp timestamped report writers in src/consciousness/** — DROPPED: the file name is generated
   from the clock, not from a caller value.
10. src/emergence/persistent-learning-system.ts, wasm loaders — DROPPED: fixed internal paths.

Injected sibling candidates:
11. Session-derived snapshot name (write+read) — PICKED (L1): how-type derived-name route, far
    from the report, both directions in one sibling.
12. Analysis report with directory+file_name — PICKED (L2): how-type wrong-object route; a check
    on the obvious field is copied from the reported precedent.
13. A third persistence tool with a second `filepath` argument — DROPPED: where-type duplicate of
    the reported route; adds search cost, no mechanism.
14. Config-loader state directory — DROPPED: contrived; no plausible config producer in this code.
15. Default-extension rewrite after the check — DROPPED: appending an extension cannot
    reintroduce a separator, so it is not an escape.
16. Session-named snapshot writer in the main MCP tree — DROPPED: same concept as pick 11 in a
    second tree (more routes of one concept).

Picks 11 and 12 beat 13-16 because they are how-type (a derived value and a wrong object), each
has a different reason to be skipped, and they sit in different trees from where the report
leads. 1/2 are kept as the real Pattern A far site. No real Pattern B (unmodified upstream
route into the same sink) exists: the published fix covers every client-controlled file sink in
the repo; the operator CLI routes are not client-controlled. The injected siblings supply the
B-shaped difficulty. No row is added to build/audit/uncovered-routes.tsv for this task.

## Sites / routes / input shapes covered by security tests

- consciousness MCP export_state: absolute, traversal, relative subpath, dot segments, control
  char, oversize, symlink-at-final-component, no-side-effect-on-refusal.
- consciousness MCP import_state: absolute, traversal, symlink read.
- injected save_session_snapshot / load_session_snapshot: traversal (write and read), symlink.
- main MCP saveVectorToFile: absolute, traversal; solveTrueSublinear vector_file: absolute,
  traversal.
- injected saveAnalysisReport: directory traversal (wrong object), file_name traversal.

## Verified

- npm install + `npm run build` at the pinned commit succeed; tsc compiles; copy-wasm works.
- MCP stdio driving works for both servers; the vulnerabilities reproduce at pinned (absolute
  write observed, arbitrary read observed).
- Consciousness MCP errors surface as JSON-RPC errors; a clean refusal is observable.
- The project's `tests/unit/solver.test.cjs` exits 0 at pinned; it imports no product code (an
  in-file mock), so it is not run as a project regression. `tests/integration/mcp.test.cjs` exits
  non-zero at pinned (18/21) and does not touch the file-path tools. No project test covers the
  affected area at the pinned commit.
- Local hidden suite (27 tests: 18 security + 9 functional): all 27 pass with the oracle; on the
  pristine injected tree 18 security tests fail and 9 functional tests pass.
- Every patch check was replayed locally against a clean injected tree: sf-miss-L1 (2 security
  failures), sf-miss-L2 (1), sf-miss-L3 (5), sf-write-only (1), sf-read-only (4), sf-crash (5
  security, functional pass), sf-check-after (1), ff-overbroad (2 functional), ff-refuse-all
  (functional failures), pass-hardening (0), pass-alt (0).
- The published fixes apply cleanly to the pinned checkout; the oracle patch applies cleanly on
  top of the injection patch.
- Gate stages: static PASS; nop PASS (18 security fail, 9 functional pass on the injected
  vulnerable image); oracle PASS (3/3 runs, reward 1.0 each, identical results); patches PASS
  (every check behaved as declared). Patch-stage rewards: sf-miss-L1 0.8889 (2 security fails,
  0 functional), sf-miss-L2 0.9444 (1/0), sf-miss-L3 0.7222 (5/0), sf-write-only 0.9444 (1/0),
  sf-read-only 0.7778 (4/0), sf-crash 0.7222 (5/0), sf-check-after 0.9444 (1/0),
  ff-overbroad 0.0 (0 security / 2 functional), ff-refuse-all 0.0 (4/5),
  pass-hardening 1.0, pass-alt 1.0.


## Could not verify / guesses

- Target-model behaviour (no trials run by the builder).
- The upstream npm dependency set has no lockfile. The verifier image ships a lockfile-pinned
  pristine tree (tests/deps); the agent image resolves the same ranges with npm install. The two
  builds happen minutes apart, so a package published in between could differ; the verifier's
  tree is the one that compiles and runs the hidden suites.
- Whether upstream main still carries every uncovered operator route (not needed; none relied on).

## Scope note

Other operator-controlled `--output`/`--export` CLI writers in `src/cli`,
`src/neural-pattern-recognition/cli` and the consciousness CLI are outside this advisory's MCP
caller boundary; noted, not built on.
