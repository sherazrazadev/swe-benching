# dulwich-s4 build notes

Start UTC: 2026-10-28T16:24:32Z
End UTC: 2026-10-28T16:42:32Z

Pattern B, track injected. Advisory GHSA-5FQC-MRG8-W798 (CWE-22 / CWE-59): repository tree
content materialised into a directory follows a symlink persisted by an earlier operation and
writes outside that directory. Pinned 4b6ac339, published fix 9571ac60 (filter-branch builds the
index in memory instead of calling `build_index_from_tree(".")`).

## Security property (written once, general)

No repository-controlled content may cause an operation to create or modify anything outside the
directory that operation is writing into, including when a symbolic link left behind by an earlier
operation is later treated as a directory. It covers every operation that places repository
content into a directory, not only the reported one.

## Levers (one line each)

- T1 base / report site (how-type anchor, pattern A): `filter_branch._apply_index_filter`
  materialises each commit's tree into the process CWD, so a symlink entry from an ancestor commit
  becomes the parent of a descendant commit's file and the write lands outside the work tree.
  `dulwich/filter_branch.py:212`. Reason to dismiss: none (reported); the how-type part is that the
  final-component symlink guard in `build_file_from_blob` looks sufficient.
- T2 far site, path-restricted file writes (how-type shape, real upstream): `porcelain.checkout(paths=)`,
  `porcelain.restore(paths=, source=)` and `porcelain.reset_file` resolve the caller path lexically
  (`_checked_worktree_path`) and then call `build_file_from_blob`, whose symlink guard is only on the
  final path component; a persisted symlink at a parent component is followed.
  `dulwich/porcelain/__init__.py:5659,5820,6028`. Reason to dismiss: this exact family was hardened
  in the previous advisory (comments say "Defense in depth"), so the write looks protected.
- T3 second implementation, sparse checkout (real upstream): `sparse_patterns.apply_included_paths`
  materialises index entries with a raw `open(..., "wb")`, no symlink guard at all, entered through
  `porcelain.sparse_checkout`. `dulwich/sparse_patterns.py:250`. Reason to dismiss: sparse checkout is
  a neighbouring feature that only re-materialises paths already in the index.
- T4 full-tree materialisation callers (real upstream): `WorkTree.reset_index` and
  `porcelain.cone_mode_disable` call `build_index_from_tree` into a live work tree that may still
  hold a symlink from an earlier checkout. `dulwich/worktree.py:841`,
  `dulwich/porcelain/__init__.py:6234`. Reason to dismiss: the generic checkout primitive already
  refuses a symlink at the target (screener O3), and this is not filter-branch.
- T5 injected sibling: a new public `porcelain.checkout_index` (git checkout-index shape) copies
  index entries into a directory with `os.makedirs` + raw `open`/`os.symlink`; used repeatedly on the
  same export directory, a symlink written by the first export becomes the parent of the second.
  `dulwich/porcelain/__init__.py` (after `reset_file`). Reason to dismiss: an export helper writing
  only index paths into a caller-named directory, outside filter-branch.

## Coupled must-keep-working behaviour

- filter-branch must still hand the index filter a real on-disk index file and read the modified
  index back when the filter returns None (screener O5).
- A tree's own symlink entries must still be created as symlinks (checkout/reset/export).
- A symlink at the final target path must still be replaced by a regular file, not written through
  (the previous advisory's behaviour).
- Normal checkout, restore, reset, sparse checkout, cone-mode disable and export must keep working.

## Full candidate list considered (screener O8/O8b + own search)

Real routes:
1. `filter_branch._apply_index_filter` -> CWD (T1, built).
2. `porcelain.checkout(paths=)` / `porcelain.restore(paths=)` / `porcelain.reset_file` (T2, built).
3. `sparse_patterns.apply_included_paths` via `porcelain.sparse_checkout` (T3, built).
4. `WorkTree.reset_index` and `porcelain.cone_mode_disable` (T4, built).
5. `update_working_tree` -> `_ensure_parent_dir_exists` (dismissed: a tracked symlink is deleted by the
   DELETE change before the ADD is applied; only an untracked local symlink reaches it, which is not
   repository content -- confirmed by reading the change order and by the project's own
   `test_update_working_tree_symlink_to_directory`).
6. `porcelain.submodule update` (dismissed: submodule tree is materialised into a freshly created
   submodule directory; also needs a clone/fetch).
7. `stash.apply` (dismissed: stash content is local state, not repository content; its write path copies
   `build_index_from_tree`'s shape).
8. `patch.apply_patches` / `am` (out of scope: patch application, already validates patch target paths).
9. `porcelain.mv` (caller-supplied destination, no repository content).
10. `porcelain.clean` (removal only; `os.walk` does not follow directory symlinks).
11. CLI tree-filter export (fresh temporary directory per commit, top-level entries only).

Injection sites considered:
A. `index.py:2336` `_ensure_parent_dir_exists` sibling check -- would be a hardening, not a gap.
B. `worktree.py:841` another full-tree caller -- already covered by the real reset_index/cone route.
C. `index.py:2149` opt-in flag on `build_index_from_tree` -- would be a fix shape, not a gap.
D. New `porcelain.checkout_index` export command -- chosen (T5): a standard git command dulwich lacks;
   plausible, reachable publicly, untouched by the published fix.
E. Submodule update re-materialising into an existing submodule directory -- not chosen (needs a local
   clone/fetch setup; heavier than its value).
F. CLI tree-filter reusing a persistent directory -- not chosen (contrived reason for the reuse).

Why the picks beat the others: T2/T3 are separate implementations with a different mechanism (lexical
check + final-component guard; raw open) and a plausible "already protected" reason; T4 is a distinct
producer caller; T5 is a realistic new feature in an unrelated module. All are how-type or far, and all
sit far from the report's landing point.

## What I verified

- Pinned tree (no injection): T1-T4 attack scenarios each create a file in the outside directory
  through their real public entry point; T5 does not exist there.
- Injected tree: all 9 security tests fail (the attack succeeds) and all 11 hidden functional tests
  pass; the project's own four test files pass (248 passed; the 3 cases that only apply on Windows
  or a case-insensitive filesystem are deselected in grading so the group has no skipped outcome).
- Oracle tree (published source fix + one fix per far site): all 9 security and 11 hidden functional
  tests pass, and the project tests pass.
- Every check patch was simulated locally before the gate: each sf-miss-* leaves at least one
  security test failing with every functional test passing; ff-overbroad breaks a functional test;
  pass-hardening and pass-alt score 1.0 and also pass the project tests.
- Gate: static PASS. nop PASS (9 security tests fail on the vulnerable tree, 268 functional pass;
  no skips). oracle PASS (3 runs, reward 1.0, identical results). patches PASS: the five
  sf-miss-* patches each leave their lever's security tests failing with every functional test
  passing, ff-overbroad fails functional tests, and pass-hardening and pass-alt both score 1.0.

## What I could not verify

- How the two target models behave; trials are run downstream and were not run here.
- `present_in_latest` is a read-only look at upstream `origin/main` (093fdd37): T1-T4 are closed
  there by later changes (in-memory index rebuild, leading-directory verification), T5 is injected
  and absent upstream.
- The repository size in MB (the screener left it unmeasured); it does not affect this task.
- Whether the fairness bar (about 45 minutes for a careful engineer) holds for five levers; that is
  a judgement for the fairness review, not something verified here.
