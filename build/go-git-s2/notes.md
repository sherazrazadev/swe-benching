# go-git-s2 — build notes

start_utc: 2026-10-27T22:25:12Z (pipeline start)
end_utc: 2026-10-27T22:59:12Z

## Stack

Pinned commit `f9d1128c6950c923a057d2bb77c54d1c702c258a` is the first parent of the published v6 fix
`da9f7d8a0e98b475600177348d6ece384a370f36` ("dotgit ref-name containment"). The second published
commit, `4a0e66d555de5f9a30c31e2df64f445f42bd01e7`, is the same advisory's backport to the v5 line;
it does not apply to this v6 module path. The verified source change is da9f7d8a's: one
`validReferenceName` helper (control characters, volume name, `.`/`..` components including HFS+/NTFS
disguises) called from the write, read, remove and three reflog sinks. Neither published commit
touches the caller-side tag shorthand, rejects metadata aliasing without traversal, or guards the
two maintenance operations this task adds.

Track: injected. `environment/injection.patch` adds two plausible reference-maintenance operations
that turn a reference name into a path themselves: a loose-reference rename (`RenameRef` /
`RenameReference`) and reflog expiry (`ExpireReflog`). Both are ordinary maintainer code, are reached
through the public storage surface, and live where the published fix never touches.

## Levers (one line each)

- T1 (pattern B, shape/how): a reference name with no parent-path component aliases git-directory
  metadata (`config`, `hooks/pre-commit`, `logs/HEAD`), and traversal names reach the same data;
  plain "inside the git directory" containment is not enough. `dotgit.go:1115/1150/1213`.
- T2 (pattern A, far site): the second write implementation for backends without ReadAndWrite
  (`dotgit_setref.go:63`) is unguarded if the check is put in the common write helper.
- T3 (pattern A, far site): the read path (`dotgit.go:1150`) returns metadata as a reference.
- T4 (pattern A, far site): the delete path (`dotgit.go:1213`) removes metadata after an existence
  check that looks like proof the name is a reference.
- T5 (pattern A, far site): the three reflog operations (`dotgit.go:271/285/294`) join into `logs/`.
- T6 (pattern B, how): `Repository.Tag` / `DeleteTag` (`repository.go:1032-1053`) clean the caller's
  shorthand with `path.Join` before storage sees it, so `../heads/main` becomes the branch.
- T7 (injected, how): `RenameRef` (`dotgit.go:1231`) checks only that the source exists and renames
  both names as raw paths; metadata can be moved into the reference tree or overwritten.
- T8 (injected, how): `ExpireReflog` (`dotgit.go:307`) rewrites the log file named by the raw
  reference name; traversal rewrites metadata in place.

## Candidate sites and routes considered

Found by the screener and by a search of every place a `plumbing.ReferenceName` becomes a path:

1. Reflog write / read / delete (`dotgit.go:271/285/294`) — the published fix (da9f7d8a) adds the
   containment check here, so it is not an uncovered route; kept as far site T5.
2. `PackRefs` deleting loose ref files named by packed-refs lines (`dotgit.go:1472`) — the names
   come from on-disk repository state, not from a caller-supplied name; a caller able to write
   packed-refs already controls the repository. Dismissed.
3. Metadata aliasing at the reference sinks — real, unmodified upstream, and the published fix
   does not reject it because it only looks for `.`/`..` components. Picked as T1 (main lever,
   how-type: containment in the git directory is not containment in reference storage).
4. `Repository.Tag` / `DeleteTag` shorthand (`repository.go:1032-1053`) — real, unmodified
   upstream, untouched by both published commits, and the `path.Join` silently rewrites the
   caller's name before the storage check runs. Picked as T6 (how-type).
5. `setRefNorwfs` (`dotgit_setref.go:63`) — the second write implementation; the published fix
   guards the dispatcher above it, so a guard placed in the common helper misses it. Picked as T2.
6. Symbolic-reference targets parsed from a ref file — the target is written as file content and
   every later resolution goes through the guarded read path, so it is not a filesystem sink.
   Dismissed (kept only as hardening: validate the target when reading).
7. Absolute and deep `../..` names — billy's bound OS filesystem contains them inside the
   repository; only names that alias entries of the git directory are reachable. Dismissed as an
   attack shape; the tests retain traversal names that alias metadata.
8. Reflog names for root pseudo-references — legitimate (`logs/HEAD`, `logs/<single-component>`);
   the rule must be traversal-only under the logs tree, not the metadata reservation. Kept as a
   functional case, not a route.
9. Injected candidate: loose-reference rename — a plausible downstream feature (go-git has no
   branch rename) implemented as an atomic loose-file rename. How-type (two operand names, source
   existence reads as validation), far from the reported write, different reason to dismiss.
   Picked as T7.
10. Injected candidate: reflog expiry — a plausible maintenance operation beside the three reflog
    operations, rewriting the log path itself. How-type (rewrites in place), different reason to
    dismiss (maintenance on logs the caller owns). Picked as T8.
11. Injected candidate: reference backup/import stream — rejected: it widens the public surface
    with a new format and a new parser, and its names come from a file rather than from the API
    caller, which weakens the property's fit.
12. Injected candidate: `Repository.DeleteBranch` also removing the branch ref — rejected: it is
    unreachable without a crafted config already containing the hostile branch name, and it changes
    a documented config-only behaviour, so it would make a valid fix look like functional breakage.
13. Injected candidate: clone-time reference copying helper — rejected: its names come from a
    remote/on-disk repository, needs a second repository and a transport in every test, and is much
    further from the advisory's own protection.

The two picked injections (9, 10) beat the rejected ones on all three counts: they are how-type
(the name-to-path join and its two operands are inside the operation), a blind engineer finds them
by searching for where a reference name becomes a path, and each has a distinct reason a solver
would leave it alone. T1 is the main lever because the published approach (reject parent-path
components) demonstrably mishandles a whole input shape, not just another entry point.

## Verified

- Every route reproduced behaviourally on the pinned+injected tree before a test was written:
  `config`, `hooks/pre-commit`, `logs/HEAD`, `refs/../../config`, `hooks/post-checkout`,
  `refs/../../packed-refs`, the three reflog operations, reflog expiry, `Tag`/`DeleteTag` shorthands,
  and both rename operand positions.
- Hidden security: 16 top-level tests (23 including subtests), all fail on the injected tree, all
  pass on the oracle. Hidden functional: 8 tests, all pass on the injected tree and on the oracle.
- Project tests `./storage/filesystem/dotgit ./storage/filesystem ./plumbing` pass on pinned,
  injected, oracle, alternative, hardening and every security_fail patch in the Go 1.26.4 image.
  Go 1.25 on the build host resolves bound-OS alternates differently and makes four unrelated
  alternates tests fail; the images pin 1.26.4, where the pinned tree is green.
- Every check patch was compiled and run against the hidden suites, and dry-run applied with
  `patch -p1` to the tree it expects. The authoritative per-check outcome is
  `gate_report.partial.json` (patches stage) and `gate-patches.log`; the failing test lists there
  are the ones the gate scored.

## Gate

- static: PASSED.
- nop: PASSED — 24 security testcases all fail on the vulnerable tree, 302 functional
  testcases (8 hidden + the project's own storage/plumbing suites) all pass.
- oracle: PASSED — 3/3 identical runs at reward 1.0.
- patches: PASSED after one correction — the first run found that `refuse_all.patch` did not
  compile (a `(*Reference, error)` method returned one value), which the gate classifies as infra
  because the verifier stops before writing results.json. The variant was rewritten to refuse
  every reference and reflog wrapper call with correct return shapes, compile-checked, and the
  stage re-ran green: all eight `miss_*` patches fail security while functional stays green;
  `refuse_all` and `reuse_validate` break functional; `hardening` and `alternative` score 1.0.
  The `blind` patch is declared in the manifest but not written (the pipeline writes it later),
  and FAIRNESS.md is not written here. `build/go-git-s2/evidence/20261027T225158Z-gate-patches.txt`
  belongs to that superseded first patches run; the re-run wrote `gate_report.partial.json` green.

## Not verified

- The published fix's intent for metadata aliases: da9f7d8a only rejects `.`/`..` components. A
  later upstream change (Oct 2026) rejects non-reference root names and fixes the tag shorthand, so
  the task's oracle is stronger than the July commit; the property states the stronger rule.
- Whether the upstream authors considered rename or reflog expiry in scope; they do not exist in
  this tree. They are the injected siblings, covered only by the general property.
- The GHSA/CVE identifiers were not independently resolved; the report never names one.

## Upgrade 2026-10-28 (BETTER-PATTERNS §2–§8)

Instruction. Rewritten to state the property once over the protected data. Removed: the list of name
sources (input / configuration / another repository), the operation list ("create, read, change or
remove"), the administrative-file list ("configuration, packed references, index, hooks, object
store"), the object-kind contracts (nested names, root bookkeeping names, symbolic references, the
placeholder, stored history), and the `refs/../../config` example with its symptom narrative. The
coupled contracts are kept only in general form ("a refused name has no effect"; "everything that
works today keeps working"). The property now says any accepted name must stay within the reference
storage, act only on the reference it denotes and that reference's stored data, never read, create,
change, move or remove another reference or other repository data, whatever the name looks like,
however it reaches the library, and whichever code path acts on it, and that a name that cannot be
confined is refused. No route, stage, object kind or count is named.

Levers. Unchanged: T1 (shape how: containment in reference storage, not in the git directory),
T6 (check-after-adjustment how: the shorthand is path-cleaned before storage sees it), T7 (rename,
how), T8 (reflog expiry, how). The task already had how-type levers, so no repo code was touched and
the prebuilt image is reusable.

Coverage added (tests/security only; no oracle change needed, verified):
- TestSec_WriteSecondImplementationDoesNotAliasMetadata — metadata aliasing on the second write
  implementation. This closes a real hole: a fix that applies the metadata rule only to the primary
  write path and only the parent-path rule to the second implementation passed every earlier test.
- TestSec_CheckAndSetDoesNotOverwriteConfig — the conditional write path.
- TestSec_TagDoesNotReturnMetadata — a shorthand that climbs to metadata and is returned as a
  reference (the storage rule catches it after the shorthand is cleaned).
- TestSec_RenameDoesNotMoveTraversalMetadata — a traversal source operand in rename.
New check patch checks/miss_alias_norwfs.patch (security_fail): full rule in the primary write path,
parent-path rule only in the second implementation. It fails only the new norwfs-alias test.

Verified locally on the pinned+injected tree with Go 1.25.0 (host toolchain; images pin 1.26.4):
all 20 security tests fail on the vulnerable tree; the oracle passes 20/20 security and 9/9
functional. alternative, hardening and blind pass 20/20 security and 9/9 functional. Every miss_*
patch still fails at least one security test with functional green; refuse_all and reuse_validate
still break functional; miss_alias_norwfs fails exactly the new test with functional green.
Manifest: patch_checks gains miss_alias_norwfs; traps gain T9 plus the new test names; status and
verified sites/routes updated. Static gate scan PASSED after the edits. nop/oracle/patches were not
re-run (left to the launcher).
