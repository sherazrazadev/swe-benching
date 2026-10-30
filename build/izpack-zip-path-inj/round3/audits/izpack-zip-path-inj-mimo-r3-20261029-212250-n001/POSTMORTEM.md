# Post-run audit: izpack-zip-path-inj__NX5QPuf

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 = 12/20 security tests passing, with all 36 functional tests passing. The model's fix is broad and well built. It adds FileUtil.hasParentDirectorySegment and an install-time resolveTarget guard in UnpackerBase that covers the target, overrideRenameTo and installTarget. It also guards MultiVolumeUnpacker, parsables, UninstallDataWriter (jar and log), lock file, temp dir, web temp folders, shortcuts and the process log. Because of this, all install-time, rename, parsable, loose, multi-volume, uninstaller-output and install-log security tests pass. The 8 failures fall into two areas the model never hardened. (1) The public PackFile constructor in izpack-api accepts a traversing target. The model read PackFile.java (transcript:14) but added no check there. (2) The configuration-task family in izpack-util (SingleOptionFileTask, SingleXmlFileMergeTask, OptionFileCopyTask, IniFileCopyTask) writes, creates parents for and deletes declared files without a check. The transcript shows no inspection of util/config at all. Both areas are covered by the instruction as written. 'No location value the toolkit accepts, however it enters the toolkit, may be retained or used...' reaches values accepted through the file-entry API. 'This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes when that location comes from the compiled installer metadata' reaches the metadata-declared configuration steps. The tests demand only refusal or absence of side effect: any exception is accepted, and the assertions only check that files are absent or unchanged. No exact error type, layer or constant is required. The reference fix guards exactly these sites (PackFile.validateTargetPath, ConfigFileTask/SingleXmlFileMergeTask/ConfigurableFileCopyTask validation per build-notes). There is no harness problem: the grading window had no agent tool calls, exception_info is null and the results are complete. There is no contamination. Confidence is medium rather than high for two reasons. These sites are far from the reported example: the config tasks are in another module, and the tests drive them directly rather than through the listener. And earlier audits flagged this scope as hard to infer, although the current instruction now states it explicitly.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigCopyTaskSecurityTest::copyDestinationDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigCopyTaskSecurityTest::iniCopyDestinationDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigCopyTaskSecurityTest::cleanupDoesNotRemoveFileOutside | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only repository exploration, offline Maven builds and the model's own new test (ParentDirectoryRefusalTest). There are no reads of the hidden tests and no web or network fetches. The model wrote its own segment-checking helper rather than copying the upstream validateTargetPath.

**Evidence:**
- evidence/grading/results.json:3-10 - the 8 failing security tests (ConfigCopyTask x3, ConfigTask x3, FileEntryApi x2); 12 security and all 36 functional pass; reward 0.6
- evidence/instruction.md:22-27 - 'No location value the toolkit accepts, however it enters the toolkit, may be retained or used ... This rule covers every file-system location ... from the compiled installer metadata or from installer variables'
- evidence/final-code/changes.patch - touches izpack-installer, izpack-panel and izpack-tools FileUtil only; no edits to izpack-api PackFile or izpack-util util/config
- evidence/transcript.md:14 - model read izpack-api PackFile.java but never guarded its constructor
- evidence/transcript.md:447 - model's own summary of enforcement sites; it lists no config tasks or PackFile constructor
- evidence/tests/security/.../FileEntryApiSecurityTest.java:38-49 - accepts any exception as a refusal; no specific type required
- evidence/tests/security/.../ConfigTaskSecurityTest.java:40-52, ConfigCopyTaskSecurityTest.java:59-71 - swallow any exception and assert only absence of side effects
- evidence/solution/fix.patch:27,35-60 - reference adds PackFile.validateTargetPath in the constructor; build-notes.md:155-158,355-358 - reference also guards ConfigFileTask, SingleXmlFileMergeTask and ConfigurableFileCopyTask
- evidence/run.json:12-20 - no tool calls during grading window; exception_info null
- evidence/build-notes.md:306-309 - earlier audits flagged config-task scope as instruction ambiguity; the instruction was then widened with the explicit metadata-coverage sentence present in this run's instruction

**Recommended action:** Accept the reward of 0.6 as a fair measure. The model fixed the install-time and installer-output routes thoroughly but missed the compile-time file-entry API and the izpack-util configuration-task family, both of which the current instruction covers. No grader or test change is needed. Optionally, note that the config-task tests drive task classes directly rather than through the listener; this is fine for any fix placed in the task classes.
