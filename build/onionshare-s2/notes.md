# onionshare-s2 build notes

- Started (UTC): 2026-10-28T03:41:48Z (driver start; this build segment began 2026-10-28T03:42Z)
- Ended (UTC): 2026-10-28T04:06Z (all gate stages complete)
- Project: onionshare/onionshare, pinned 8cc75e1d7e88bd31f7276733449d412bf71c8999 (direct parent of the
  published fix 48f31cfac077fcc9c04c67c2a6dbf87d956f5eec), advisory GHSA-22P9-R2F5-22MF /
  CVE-2026-54706 / PYSEC-2026-3585, CWE-59.
- Pattern A+B, track injected. All work stayed inside the advisory's share/website disclosure
  property, in this repository, at the pinned commit.

## Design before building

The protected data is the bytes of every file whose real location is outside the folders the user
selected. The property is written once in `instruction.md` ("no one may obtain the contents of any
file that really lives outside the locations the user is sharing, through any request the
application answers ... however that entry came to be part of the share"). Every route and sibling
below falls under that sentence as written, and the report never describes where any of them lives.

### Every sibling site / route found (including the ones not picked)

Real upstream:
1. `share_mode.build_zipfile_list` single-file convenience branch (only entry of a share streamed
   directly). Chosen (T3): protected-data route untouched by the published fix, HOW-type (must
   understand that this branch bypasses the filtered inventory and pre-compresses the target).
2. `send_base_mode.build_directory_listing` stats every `os.listdir` name, so a shortcut's name and
   target size are shown. Not built: metadata only, the advisory property is content disclosure.
   Logged in the uncovered-routes register.
3. `receive_mode` "serve back what was uploaded" has no route at the pin; the receive directory is
   a write-direction concern. Not built: different protection, out of the advisory's scope.
4. Desktop `_compute_total_size` follows a file argument without an islink test. Not built: GUI,
   cannot run offline; out of the CLI/web entry point.
5. `common.dir_size` already skips links. No gap.
6. Persistent `--persistent` saved `filenames` reloaded without re-validation. Not built as a
   separate lever: a sink-level decision covers it, and the project's own web-test idiom drives
   `set_file_info` rather than the CLI parser, so a CLI-parser-only fix already fails every test.
7. Website `index.html` resolved through a shortcut (same inventory sink as T1). Merged into T1,
   not a separate route.

Injected siblings (code a maintainer could plausibly have left, reachable through the real entry
point, covered by the general property, placed where the published fix has no hunk):
8. Per-folder archive route `/download/<path>` with its own `os.walk`. Chosen (T5): a second
   bundler implementation, far from the report, dismissed as "the inventory is already filtered".
9. Preview route `/preview/<path>` with an inventory refreshed from the shared folders.
   Chosen (T6): its own read sink plus a producer (the refresh) the inventory check never sees;
   dismissed as a display convenience. A shortcut added after startup is its observable shape.
10. A second individual-file route (raw file by path join). Not chosen: it would introduce CWE-22
    path traversal, outside this advisory's protection, and would be a route of the reported
    concept rather than a distinct mechanism.

Why the two injected picks beat the others: both are HOW-type (own walk / own read plus a separate
inventory producer), both are reachable from the ordinary share page and sit in a different part of
`share_mode.py` from the report's landing point, and each has a different dismissal reason (T5
"reuses the filtered inventory"; T6 "only a display convenience"). The metadata listing was rejected
because it discloses no content; the receive-mode and desktop candidates are outside the advisory's
protection/entry point; the persistent reload is not independently observable once the decision is
made at the sink.

## Levers (one line each)

- T1 (advisory route, Pattern A base): inventory-fed individual streaming of a shortcut inside a
  shared folder; `send_base_mode.py:73`; dismissed as "the report's obvious landing point is
  enough".
- T2 (far site, Pattern A): archive writer copies a shortcut found in the raw bundle list;
  `share_mode.py:644`; dismissed as "the inventory is already filtered, so the bundle is covered".
- T3 (uncovered route, Pattern B): single-file convenience branch serves the only entry of a share
  without the decision; `share_mode.py:542`; dismissed as "one file the user named, not a walk".
  **Real upstream code; the published fix does not touch it (confirmed: the published source diff
  applied to the pin still discloses through this branch).**
- T4 (shape trap, HOW-type): containment by bare string prefix accepts a sibling directory whose
  path starts with the shared folder's name; `send_base_mode.py:73`; dismissed because the report's
  example target is nowhere near the shared folder.
- T5 (injected sibling): per-folder archive route walks the folder itself; `share_mode.py:260`;
  dismissed as "reuses the filtered inventory".
- T6 (injected sibling): preview over a refreshed inventory; `share_mode.py:294` and `:482`;
  dismissed as "a display convenience, not a download".
- Coupled must-keep-working: ordinary files next to an unservable entry keep downloading
  individually, browsing keeps listing them, and both archive forms keep carrying them; a share of
  one ordinary file keeps delivering it. Covered by 7 functional tests plus the project's own
  `cli/tests/test_cli_web.py`.

## Verified locally (no Docker)

- Pinned+injected baseline: 10/10 security tests fail, 7/7 hidden functional tests pass, and the
  project's own web suite passes with the three live-client range tests deselected (127 passed, no
  skips; the full file passes locally at 129 passed, 1 skipped).
- Reference fix: 10/10 security pass, 7/7 hidden functional pass, the same 127 project tests pass.
- Every checks/ patch applied to a fresh injected copy:
  - sf-miss-L1: 5 security fail (4 individual + the prefix individual), functional pass.
  - sf-miss-L2: 3 security fail (whole-share archive, prefix archive, single-shortcut archive),
    functional pass.
  - sf-miss-L3: 1 security fail (single-shortcut convenience branch), functional pass.
  - sf-shape-prefix: 2 security fail (both prefix shapes), functional pass.
  - sf-miss-S1: 1 security fail (per-folder archive), functional pass.
  - sf-miss-S2: 1 security fail (shortcut added after startup via the preview), functional pass.
  - sf-crash: 5 security fail (raises instead of refusing), functional pass.
  - ff-overbroad: 4 functional fail (individual downloads, website files, browsing, per-folder
    archive), security pass.
  - ff-adjacent-api: 2 project tests fail (`add_file`, `add_directory` with no web object),
    security and hidden functional pass.
  - pass-alt and pass-hardening: everything passes.
- The published fix applied to the pin: individual and whole-share archive routes close, the
  single-file branch still discloses (T3), and a link that resolves inside the shared folder stops
  being served. We do **not** require in-root links to keep working, so the reference fix is the
  published mechanism plus the uncovered-route and sibling fixes, with no change of the published
  behaviour for legitimate ordinary files.
- Upstream latest (read-only): the single-file branch is now guarded at the producer
  (`share_mode.py:473-480` on main) and the listing skips links (`send_base_mode.py:218`), so both
  register rows are `present_in_latest=no`.

## Could not verify

- No target-model trials were run (instructed not to run them), so the breaker bar itself is not
  measured here; the gate proves the task is well formed, not that the models fail it.
- Nothing else: the reproduction, reference fix and every check patch were executed locally and
  again in the offline containers.

## Gate results (container, offline verifier, project runner)

- static: PASS (conformance, no instruction leaks, strict catalogue, canary GUIDs).
- nop: PASS — pinned+injected code: 10/10 security tests fail, 34/34 functional pass (7 hidden +
  27 selected project tests), 0 skipped.
- oracle: PASS — 3/3 runs reward 1.0, 44/44 tests pass, and the three result maps are byte-identical.
- patches: PASS — all 11 declared outcomes matched:
  - security_fail / 0 functional fail: sf-miss-L1 (5 security), sf-miss-L2 (3), sf-miss-L3 (1),
    sf-shape-prefix (2), sf-miss-S1 (1), sf-miss-S2 (1), sf-crash (5).
  - functional_fail / 0 security fail: ff-overbroad (4), ff-adjacent-api (2).
  - pass at reward 1.0: pass-alt, pass-hardening.
  - blind.patch is produced downstream by run_blindfix; it is listed but absent.
  Note: the first nop attempt failed because the project's three live-client range tests skip when
  their client binary is absent and the gate counts a skip as not-pass; the final verifier deselects
  those three and the two parametrised random-string groups (whose ids change per run, which would
  break the oracle identity check). The selected 27 project tests are deterministic and cover the
  affected share/zip/range area.

## Fairness notes (self-review)

- A blind engineer can find every lever by reading `cli/onionshare_cli/web/` and grepping for
  `os.walk`, `open`, `zipfile`, and `send_file`: the inventory, the archive writer, the single-file
  branch, the folder route and the preview are all visible, and the prefix boundary is standard
  expert knowledge.
- The instruction states the property once, the refusal form, the preservation clause, and a
  magnitude; it never names a route, module, function or format.
- The injected routes are ordinary features reachable from the share page; deleting them to "fix"
  the leak would fail the preservation functional tests, which the instruction's preservation
  clause covers.
- No exploitation steps are written in prose anywhere; the tests carry the detail.

## Out of scope (one line)

- Receive mode joins a client-supplied upload name onto the receive directory
  (`receive_mode.py:112-114`); that is a write-direction path concern, not this advisory's
  disclosure property, and was not used.

## Pattern B register rows

Appended to `build/audit/uncovered-routes.tsv`:
- `onionshare-s2 / onionshare/onionshare / GHSA-22P9-R2F5-22MF ... / T3 / real_upstream=yes /
  present_in_latest=no / built / pending client decision` — the single-file convenience branch.
- `... / listing-metadata / real_upstream=yes / present_in_latest=no / not built / pending client
  decision` — the listing shows a shortcut's name and target size; metadata only.
