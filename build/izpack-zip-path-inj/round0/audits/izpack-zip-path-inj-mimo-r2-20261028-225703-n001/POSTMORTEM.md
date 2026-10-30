# Post-run audit: izpack-zip-path-inj__qSidtWK

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.4667.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.4667 = 7/15 security tests passing with all 31 functional tests passing (score.py threshold mode). The model hardened the pack-file unpack path well: UnpackerBase/MultiVolumeUnpacker target checks after variable substitution, override-rename, loose installTarget, parsables, executables, and PackInfo.addFile at compile time. All unpacker-related security tests pass, and those passes are real. The 8 failures fall into three groups. (1) UninstallDataWriter (uninstaller directory, uninstaller name, install.log path, derived log path; 4 tests): the model never opened this class, although the instruction's invariant covers every location value from packaged metadata 'whichever installation step would use it'. (2) ConfigFileTask/SingleOptionFileTask toFile/oldFile (2 tests): not touched. The instruction explicitly lists write and delete, and the reference fix guards these. (3) FileEntryApiSecurityTest (2 tests): these construct PackFile directly with 'sub/../escape.txt'. The model guarded PackInfo.addFile instead of the PackFile constructor. That is a plausible but narrower reading of 'public file-entry interface'. PackFile is literally the file-entry class, and the reference validates in its constructor, so I count this as a mild ambiguity, not a test fault. No harness errors, no grading-window activity, and no contamination. The failures reflect real gaps in the model's coverage of the stated invariant, not unfair tests.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::logFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows no access to hidden tests: the /tests and bench-package searches turn up only repo-internal paths. There was no upstream lookup. One wget, made by mvnw, failed (transcript line 195). The 'installed ...' lines (250, 264, 292) are locally compiled stub jars placed in ~/.m2 so the offline build could run, not network downloads. No netguard.log is present.

**Evidence:**
- evidence/grading/results.json: 8 security fails (ConfigTask x2, FileEntryApi x2, InstallLog x2, UninstallerOutput x2), 7 security passes, all functional tests pass; reward 0.4667 = 7/15
- evidence/tests/score.py:58-64: threshold reward = share of security tests passing when all functional tests pass
- evidence/instruction.md:25-29: 'No location value ... from an installer's packaged metadata may be used to create, write, move, rename, rewrite or delete ... whichever installation step would use it'
- evidence/instruction.md:30-32: the public file-entry interface must refuse a traversing target at compile time
- evidence/final-code/changes.patch: touches FileUtil, UnpackerBase, MultiVolumeUnpacker, FileUnpacker, LooseFileUnpacker, ScriptParser, PackInfo, CompilerConfig; no UninstallDataWriter, ConfigFileTask, SingleXmlFileMergeTask or PackFile change
- evidence/solution/fix.patch: validates in the PackFile constructor and in UninstallDataWriter (log/uninstaller dir/name), ConfigFileTask and SingleXmlFileMergeTask
- evidence/transcript.md:54-55: the model listed UninstallDataWriterTest but never inspected the writer; line 189 'All write paths are covered.'
- evidence/tests/security/.../FileEntryApiSecurityTest.java:19-23: directly constructs PackFile and accepts any Exception as refusal (no over-specified exception type)
- evidence/run.json: tool_calls_during_grading empty, agent_events_after_end 0, exception_info null
- evidence/tests/harness/run_group.sh:34: runs -pl izpack-installer -am, so the izpack-util config tasks are in scope of the build

**Recommended action:** Accept the reward as a fair measure (model-failed). Optionally make the instruction say more clearly that the 'public file-entry interface' means the PackFile entry itself, not only the pack-level addFile. That reading affects 2 of 15 security tests, and fixing it would not change the overall attribution.
