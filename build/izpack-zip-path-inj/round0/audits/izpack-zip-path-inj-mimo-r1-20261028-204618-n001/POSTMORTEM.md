# Post-run audit: izpack-zip-path-inj__tvNAfjg

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.3333.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.3333 = 5/15 security tests passed, all 31 functional tests passed. Of the 10 security failures, 2 (LooseRelocationSecurityTest, OverrideRenameSecurityTest) are test faults. Both report 'error', not 'fail'. Each test builds its malicious metadata by calling PackInfo.addFile with a traversing installTarget or overrideRenameTo. The model hardened PackInfo.addFile to throw IllegalArgumentException on exactly those values, so the test setup crashes before the installer ever runs. The instruction supports refusing them there: the rule holds 'however the value is carried'. The model's install-time checks in UnpackerBase.hasTraversingLocation, handleOverrideRename and FileUnpacker.checkTarget also cover both cases, so it would very likely have passed both tests if the fixture had injected the metadata without going through addFile. The other 8 failures are genuine model shortfalls. The model never hardened UninstallDataWriter (uninstaller path/name, install log path), even though it read that code (transcript.md:127-128). It never hardened the ConfigFileTask/SingleOptionFileTask sinks. It put the compile-time check in PackInfo.addFile instead of the PackFile constructor, which is the class the file-entry test builds directly. Under a fair grader the score would be about 7/15 (0.467) instead of 0.333. The 'not solved' outcome is reliable, but the reported reward number understates the model's work because of the 2 test-fault items.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | fail | test-fault | True | True |
| com.izforge.izpack.installer.bench.security.OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | fail | test-fault | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::logFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only exploration of /workspace source and the local ~/.m2 repository. There is no access to hidden tests (bench/security) and no network fetch of the upstream fix. No netguard.log is present. The grading window has no tool calls (run.json timing.tool_calls_during_grading = []).

**Evidence:**
- evidence/grading/results.json:9 LooseRelocationSecurityTest -> 'error'; :11 OverrideRenameSecurityTest -> 'error'
- evidence/tests/security/.../LooseRelocationSecurityTest.java:33-36 pack.addFile(..., additionals{installTarget:'../escape/loose.txt'})
- evidence/tests/security/.../OverrideRenameSecurityTest.java:34-35 pack.addFile(..., "../escape/", ...)
- evidence/final-code/changes.patch:313-331 PackInfo.addFile throws IllegalArgumentException for traversing target/overrideRenameTo/installTarget
- evidence/final-code/changes.patch:462-468, 555-569, 649-660 install-time refusal of installTarget and overrideRenameTo
- evidence/solution/fix.patch:27 the reference validates the target only in the PackFile constructor, not rename/installTarget, so the test fixtures were built around it
- evidence/instruction.md:25-32 'however the value is carried' plus the compile-time 'public file-entry interface' rule
- evidence/tests/security/.../FileEntryApiSecurityTest.java:19-23 constructs PackFile directly
- evidence/transcript.md:127-128 the model inspected UninstallDataWriter path handling but did not change it
- evidence/solution/fix.patch:104-115, 1499-1501 the reference hardens UninstallDataWriter and ConfigFileTask, which the model omitted
- evidence/grading/test-stdout.tail.txt is empty, so the error cause is inferred from code: an uncaught IllegalArgumentException in the test body

**Recommended action:** Fix LooseRelocationSecurityTest and OverrideRenameSecurityTest so they inject the traversing installTarget/overrideRenameTo without going through PackInfo.addFile (for example, construct a PackFile and put it into getPackFilesMap(), or catch a compile-time refusal and count it as a pass), then rescore. The expected corrected reward is about 0.467 (7/15), still a model failure. Until then, report this trial as not solved but with an understated score.
