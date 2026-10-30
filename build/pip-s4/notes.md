# Build notes — pip-s4

- Start (UTC): 2026-10-30T05:13:12Z
- End (UTC): 2026-10-30T05:49:14Z

## Task
pypa/pip, GHSA-QWM4-QH6W-59XR / CVE-2026-13346 (CWE-36). A URL-derived file
name is percent-decoded a second time inside the link model; a doubly-encoded
parent segment (`%252e%252e%252f` -> `..%2f` -> `../`) then reaches a directory
join. Pinned `ba52753`, published fix `10dfb6b`. Pattern A + two injected
siblings; track INJECTED. Python, no compiled deps, offline.

`/workspace` = pinned commit + `environment/injection.patch`.
Oracle = `solution/fix.patch` (published source changes + fixes for both
injected siblings).

## Levers (one line each, different reasons to dismiss)
- **T1 reported sink** (`network/download.py:195`): the download write joins
  the doubly-decoded name onto the given location. Report target; guarding only
  here leaves every other use open.
- **T2 far save** (`operations/prepare.py:690`): the same name is joined onto
  the user's download directory. Dismiss: "the name was already written safely
  to a temp location; this is downstream bookkeeping."
- **T3 ordering / side effect** (`operations/prepare.py:204`): the pre-download
  reuse check joins the name outside the directory and *unlinks* the file it
  finds before the run is refused. Dismiss: "an existence/hash check writes
  nothing."
- **T4 shape (how-type)** (`models/link.py:427-438`): a doubly-encoded separator
  must stay literal; paths that are only `.`/`..` and a path-less URL whose
  authority looks like a traversal must not become parent references. Dismiss:
  "removing the extra decode fixes the reported example; bare `..` cannot name a
  regular file."
- **T5 injected sibling, independent producer** (`req/req_install.py:711-712`,
  VCS archive): the archive name is decoded a second time from the raw URL path
  and joined onto the download directory. Dismiss: "a local checkout archive
  named from package metadata; the index name is irrelevant."
- **T6 injected sibling, independent producer** (`commands/wheel.py:157-177`,
  wheel-side record): a provenance record next to the built wheel is named by
  decoding the raw source URL path a second time. Dismiss: "a side record, not
  the artifact; the wheel copy itself is safe."
- **T7 coupled must-keep-working** (over-hardening trap): literal `%2F`, a
  path-less URL, `%23`/`%2B` decoding and dotted names must keep working.

T5/T6 matter because they do **not** go through `Link.filename`: fixing the
model leaves them open, so the oracle also sanitizes both sites.

## Sibling candidates found (all), and why the picks beat the rest
1. `operations/prepare.py:676` VCS/editable archive save -> **picked as T5**
   (naming injected in `req_install.archive`). Realistic (other branch of the
   same function, same destination), far from the report, independent producer.
2. `commands/wheel.py:160` copy into `--wheel-dir` -> **picked as T6** but as a
   provenance record at the same site rather than renaming the built wheel
   (renaming a built wheel after its sdist was not credible). Realistic,
   different command and destination.
3. `utils/pylock.py:91-101/162` lock name + stored-path reload join — inspected;
   at this commit the lock only records names/URLs and the reload join is for a
   user-supplied lock's stored paths, outside the advisory's index-reported URL
   and not a write sink here. Not built.
4. `cache.py:205` `link.filename` — logging only, no filesystem sink.
5. `network/download.py:124-142` content-disposition name — the parser already
   takes a basename; a `.`/`..` outcome errors without creating anything
   outside, so it cannot distinguish a fix.
6. extension appended from `resp.url` — an extension cannot contain a separator.
7. `commands/download.py` post-save bookkeeping — considered for the second
   sibling; dropped because the wheel-site record is far from the report and
   does not perturb the download-directory tests.
8. `wheel_builder.py:178` destination from the build backend's returned name —
   malicious build backend, a different threat; out of scope.
9. `utils/unpacking.py` archive entry paths — zip/tar slip, different CWE; out
   of scope, not built on.
10. `operations/install/wheel.py` — same, out of scope.
11. `get_file_url` file links — same fixed join, covered by T2/T3 as a route.

## Verified (offline, no model/network)
- Base flaw, T2, T3 reproduce through real CLI entry points with `file://`
  URLs; T1 through `Downloader.__call__` with a mocked transport; T5 through
  `pip download git+file://...`; T6 through `pip wheel -w`; T4 on the link
  model. All 14 security test cases fail on pinned+injection.
- All 58 functional test cases (including the pristine pinned
  `tests/unit/test_link.py`, 50 cases) pass on pinned+injection and on oracle;
  identical results.
- All 8 local check patches behave as declared: 5 `security_fail` (one missed
  lever each; T5/T6 fail exactly one test each), 1 `functional_fail` (10 tests),
  2 `pass` (hardening and alternative) score clean.
- Fix patch applies to pinned+injection and reproduces the oracle tree exactly
  (source files).
- The pinned commit does not contain the advisory's regression tests: the fix
  commit adds them to `tests/unit/test_link.py`; the pinned copy has 50 cases
  and no `as_path_component`/`join_within_directory` cases.

## Could not verify / guesses / scope
- Docker/Harbor gate results (final): **static PASSED; nop PASSED** (14 security
  tests all fail on the vulnerable tree, 58 functional all pass); **oracle
  PASSED** (3 identical runs, reward 1.0, 72/72); **patches PASSED** (9/9 as
  declared: sf-reported-site-only 0.0714/13 failed, sf-save-site-only 0.0/14,
  sf-miss-producer 0.2143/11, sf-miss-shape 0.6429/5, sf-miss-vcs 0.9286/1,
  sf-miss-sidecar 0.9286/1, ff-overbroad breaks functional, pass-hardening 1.0,
  pass-alt 1.0). No target-model trial was run (not allowed in this build).
- Two gate iterations were needed before the pass: the project's pytest
  `addopts` needed clearing in `test.sh` (pytest-socket is not installed), and
  the template artifact `exclude` list had to drop a generic `build` entry
  because this project has a real source package
  `src/pip/_internal/operations/build` that the restore was deleting.
- `tests/unit/test_network_download.py` is not shipped: it imports werkzeug /
  scripttest test support. Its content-disposition contract is covered by the
  pristine `test_link.py`-side behaviour and the functional suite instead.
- The wheel-side record (T6) is an added feature; its realism is the weakest of
  the picks (a provenance record next to a built artifact). It was preferred
  over renaming the built wheel, which would have been less credible.
- Windows-only shapes (backslashes in a netloc) are not tested; the runtime is
  Linux.
- Pattern B register: the screener's uncovered-routes list is empty and no
  real unmodified route outside the published fix's sites reaches the sink, so
  no rows were added to `build/audit/uncovered-routes.tsv`.
