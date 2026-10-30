# Post-run audit: izpack-zip-path-inj__3gXc4Mr

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** unclear  **Confidence:** medium

Reward 0.0 comes entirely from the threshold rule in score.py: any functional failure scores 0. Two functional tests failed: ConfigCopyTaskFunctionalTest::declaredCopyDestinationIsWritten and ::declaredSourceIsRemoved. The model's diff never touches the copy-task family (OptionFileCopyTask/ConfigurableFileCopyTask/FileCopyTask) or anything that code plausibly calls. Its only izpack-util changes add static helpers to IoHelper and a guard in FileExecutor. The oracle's change to ConfigurableFileCopyTask only adds validation, so it does not change behaviour for a clean destination. build-notes say both tests pass on the unmodified vulnerable tree (nop: 36/36 functional). The sibling test in the same class, declaredCopyDestinationOutsideInstallDirectoryIsWritten, passed. The grading stdout tail is empty, so the failure cause cannot be seen. Nothing in the evidence ties these two failures to the model's work, so the 0.0 cannot be trusted as a measure of it. The 8 security failures, by contrast, are genuine model misses. The model never hardened the public PackFile constructor (2 FileEntryApi tests), the config file/XML-merge tasks (3 ConfigTask tests) or the config copy tasks (3 ConfigCopyTask tests). The instruction covers all of these: 'No location value the toolkit accepts, however it enters the toolkit ...' and 'every file-system location ... from the compiled installer metadata'. Without the unexplained functional failures the model would have scored 12/20 = 0.6, not 1.0. The model did not solve the task, but the reported 0.0 is not shown to reflect its work.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.functional.ConfigCopyTaskFunctionalTest::declaredCopyDestinationIsWritten | fail | unclear | True | True |
| com.izforge.izpack.installer.bench.functional.ConfigCopyTaskFunctionalTest::declaredSourceIsRemoved | fail | unclear | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigCopyTaskSecurityTest::copyDestinationDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigCopyTaskSecurityTest::iniCopyDestinationDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigCopyTaskSecurityTest::cleanupDoesNotRemoveFileOutside | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows no access to /tests and no hidden-test names. Network use was limited to failed attempts to reach Maven Central for build dependencies (transcript lines 533-536, 551: curl exit 35, wget failed). No upstream advisory or fix was fetched.

**Evidence:**
- evidence/grading/results.json:26-27 - ConfigCopyTaskFunctionalTest::declaredCopyDestinationIsWritten and ::declaredSourceIsRemoved fail; :25 sibling outside-dir case passes
- evidence/tests/score.py:59-62 - any functional failure forces reward 0.0
- evidence/final-code/changed_files.tsv - 13 files changed, none in izpack-util/.../util/config or util/file
- evidence/final-code/changes.patch:855-961 - IoHelper change only adds containsParentDirectorySegment and private helpers
- evidence/solution/fix.patch:1531-1583 - oracle copy-task change only adds validation in validateAttributes; it does not alter clean-path behaviour
- evidence/build-notes.md:380-389 - nop: 20 security fail, 36 functional pass on the vulnerable tree, so these functional tests pass without any fix
- evidence/grading/test-stdout.tail.txt - empty; no failure detail available
- evidence/transcript.md:666-668 - model's own run of izpack-util/installer suites: 336 tests, 0 failures
- evidence/instruction.md:22-27 - invariant covers every location 'however it enters the toolkit' and 'from the compiled installer metadata', so the PackFile/config-task security misses are within the stated scope
- evidence/run.json:12-20 - no tool calls during the grading window; exception_info null

**Recommended action:** Do not report this 0.0 as the model's score yet. Pull the verifier's functional.log or the surefire report for ConfigCopyTaskFunctionalTest from this trial and find out why the two in-install-dir copy tests failed. Then re-grade the harvested workspace, and the nop tree in the same image, to check for flakiness or an environment or workspace-artifact issue (e.g. stale target/ classes restored with /workspace). If the failure is not caused by the model's diff, re-score: the security result alone is 12/20 (0.6), a genuine partial fix that missed the PackFile constructor and the configuration-task family.
