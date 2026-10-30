# Post-run audit: izpack-zip-path-inj__M5nyXoL

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 = 12/20 security passing, 36/36 functional passing. The model built a careful install-time fix: a segment-exact IoHelper.containsParentDirectorySegment predicate, with checks in UnpackerBase (target, overrideRenameTo, loose installTarget, parsables, executables, update checks, installation info), FileUnpacker/LooseFileUnpacker sinks and UninstallDataWriter (log and uninstaller jar). That covers L1/B1/B2/S1/S2/N1/N2, and those tests pass for real. It failed 8 tests in two groups that its own design deliberately left out. (a) FileEntryApiSecurityTest (2): the public PackFile constructor still accepts 'sub/../escape.txt' and 'sub\\..\\escape.txt'. The model read PackFile.java (transcript:19) but chose 'at the point of use — install time' (transcript:509). The instruction explicitly says no location value 'however it enters the toolkit, may be retained' (instruction.md:22-24), so a value retained by a constructor is in scope. (b) ConfigTaskSecurityTest (3) + ConfigCopyTaskSecurityTest (3): the izpack-util configuration tasks (SingleOptionFileTask, SingleXmlFileMergeTask, OptionFileCopyTask, IniFileCopyTask) still create, write and delete at '../escape/...' locations. The patch never touches izpack-util/config, and the transcript shows no investigation of it. The instruction covers 'every file-system location the installer creates, writes, ... deletes when that location comes from the compiled installer metadata' (instruction.md:25-27), and these tasks are declared in installer metadata and run by the installer. The reference fix guards both sites, and the tests ask for no specific exception type, message or layer: they only check that nothing is written or deleted outside, and any exception is accepted. So a reasonable complete fix passes. One caveat keeps confidence at medium rather than high: the config-task tests drive the task classes directly rather than through the metadata/listener path (build-notes.md:199-202). A fix that guarded only the izpack-event listener would be marked wrong, but the model made no attempt there, so this caveat does not change this run's score. No harness issues: grading ran after the agent ended, with no tool calls inside the grading window (run.json timing). There is no sign that the model read the hidden tests or looked up the upstream fix; the only network attempt was a failed Maven wrapper download.

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

**Lookup or leak:** None found. The hidden tests are not referenced in the transcript, and there is no web lookup of an advisory or upstream fix. The only network attempt was the Maven wrapper download, which failed (transcript:173). Missing third-party jars were replaced with locally written compile-only stubs in ~/.m2, not fetched. No netguard.log is present.

**Evidence:**
- evidence/grading/results.json: 8 security fails (FileEntryApi x2, ConfigTask x3, ConfigCopyTask x3), all 36 functional pass, reward 0.6 = 12/20
- evidence/instruction.md:22-27: 'No location value the toolkit accepts, however it enters the toolkit, may be retained or used ... This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes when that location comes from the compiled installer metadata or from installer variables.'
- evidence/final-code/changes.patch: changes only IoHelper, UnpackerBase, FileUnpacker, LooseFileUnpacker and UninstallDataWriter, plus tests; no PackFile.java and no izpack-util/config changes
- evidence/transcript.md:19: model read izpack-api PackFile.java
- evidence/transcript.md:509: 'refused ... at the point of use — install time'
- evidence/solution/fix.patch:27,1510-1512,1558-1567,1604-1610: oracle validates in the PackFile constructor, ConfigFileTask.checkAttributes, ConfigurableFileCopyTask.validateAttributes and SingleXmlFileMergeTask.validate
- evidence/tests/security/.../FileEntryApiSecurityTest.java:38-49 and ConfigTaskSecurityTest.java:40-52: any exception is accepted; only absence of side effects is asserted
- evidence/build-notes.md:199-202: config tasks are driven directly, not via the izpack-event listener (minor fidelity caveat)
- evidence/run.json: tool_calls_during_grading = [], exception_info = null

**Recommended action:** Accept the 0.6 as a fair measure: the model fixed the install-time sinks well but skipped the 'however it enters the toolkit / retained' constructor site and the configuration-task family. Optional task hardening: add a note or test showing that the config-task tests correspond to metadata-declared actions, so that a listener-level guard is not unfairly penalised.
