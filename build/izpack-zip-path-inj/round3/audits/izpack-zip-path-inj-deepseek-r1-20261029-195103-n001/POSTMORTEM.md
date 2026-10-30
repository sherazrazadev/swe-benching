# Post-run audit: izpack-zip-path-inj__CsGcFg2

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 = 12/20 security tests passing with all functional tests passing (score.py:64, threshold mode). The model put solid '..' checks on the installer-side sinks: the unpacker target paths, multi-volume and loose relocation, override-rename, parsables, install log, uninstaller output and the summary log. All 12 of those security tests pass. The 8 failures fall into two gaps. (1) The configuration-task sinks: OptionFileCopyTask/IniFileCopyTask toFile and the cleanup source, SingleOptionFileTask toFile/oldFile, and SingleXmlFileMergeTask toFile. The model only validated fileset dir/file attributes in ConfigurationInstallerListener (changes.patch:940-956). It never validated tofile/patchfile/oldfile at either the listener or the task layer, even though it found these classes (transcript.md:357-358). (2) The PackFile constructor still accepts traversing targets. The model read PackFile.java (transcript.md:38) but added no check there. The instruction covers both: it says no location 'however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete' and it covers every location 'from the compiled installer metadata'. Configuration actions are compiled metadata, and a PackFile is the retained entry. The reference fix validates at exactly these points (fix.patch:27, 1493-1622), and its approach would pass these tests. One residual concern keeps confidence at medium rather than high: the config-task tests call the task classes directly, so a fix that validated only in ConfigurationInstallerListener would also fail them. This model did not do that either, so the concern does not change this trial's attribution. No infra problems: grading finished with no agent tool calls inside the window (run.json timing), and results.json is complete. No contamination was seen.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| ConfigCopyTaskSecurityTest::copyDestinationDoesNotEscape | fail | genuine-fail | True | True |
| ConfigCopyTaskSecurityTest::iniCopyDestinationDoesNotEscape | fail | genuine-fail | True | True |
| ConfigCopyTaskSecurityTest::cleanupDoesNotRemoveFileOutside | fail | genuine-fail | True | True |
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The only network activity was a Maven distribution download that failed and offline Maven errors (transcript.md:89, 93). The transcript shows no access to the hidden test paths or to the upstream advisory or fix. No netguard.log was provided.

**Evidence:**
- evidence/grading/results.json:3-10 - the 8 failing security tests (config tasks and PackFile API); all functional tests pass
- evidence/tests/score.py:12-14,64 - reward = security pass share (12/20 = 0.6) when functional tests all pass
- evidence/instruction.md:22-27 - 'however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete ... from the compiled installer metadata'
- evidence/final-code/changes.patch:940-956 - only fileset dir/file validated in ConfigurationInstallerListener; no changes in izpack-util config tasks or PackFile
- evidence/transcript.md:38 - model read PackFile.java; transcript.md:357-358 - model located ConfigFileTask/ConfigurableFileCopyTask and moved on
- evidence/solution/fix.patch:27,35-60 - reference validates in PackFile constructor; fix.patch:1493-1622 - reference validates in ConfigFileTask, ConfigurableFileCopyTask, SingleXmlFileMergeTask
- evidence/run.json timing - tool_calls_during_grading empty, agent_events_after_end 0
- evidence/grading/test-stdout.tail.txt - empty, but results.json is complete with all 37 tests

**Recommended action:** Accept reward 0.6 as a fair model-failed result. Optional task hardening: the config-task tests require validation inside the task classes. A fix that validated only in ConfigurationInstallerListener would fail them. Consider making the instruction say that the reusable configuration and file-entry APIs must refuse such locations themselves, or add a listener-level test alongside the direct task tests.
