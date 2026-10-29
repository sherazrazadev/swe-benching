# Post-run audit: izpack-zip-path-inj__7RAitvn

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 = 12/20 security tests passing with all 37 functional tests passing (score.py threshold rule: sec_ok/len(sec) when functional all pass). The model added an IoHelper.containsParentDirectory helper and applied it across the runtime unpack path (UnpackerBase, MultiVolumeUnpacker, LooseFileUnpacker, override-rename, parsables, executables, uninstaller writer, log files), so all the unpack/log/uninstaller security tests pass. The 8 failures come from two areas the model never touched: (a) the PackFile constructor still accepts a '..' target, so a traversing location is 'retained' (FileEntryApiSecurityTest x2), and (b) the configuration tasks in izpack-util/config (SingleOptionFileTask/ConfigFileTask, SingleXmlFileMergeTask, OptionFileCopyTask/IniFileCopyTask) still write, copy or delete through '..' locations (ConfigTaskSecurityTest x3, ConfigCopyTaskSecurityTest x3). The instruction explicitly covers both: 'No location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything' and 'every file-system location ... when that location comes from the compiled installer metadata'. Configuration steps are compiled-metadata-driven write/delete operations. The reference fix hardens exactly these places (PackFile.validateTargetPath, ConfigFileTask.checkAttributes, ConfigurableFileCopyTask.validateAttributes, SingleXmlFileMergeTask). The tests do pin a layer, since they call the task and PackFile classes directly, and that is why confidence is medium rather than high. A fix only at ConfigurationInstallerListener would fail them. But the model added no config-task check at any layer, so the misses are its own. No harness problems, no contamination.

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

**Lookup or leak:** None found. The only network access was the Maven wrapper trying to download a Maven distribution (transcript line 267, failed). The agent then used the system mvn offline. There is no evidence that it read evidence/tests or bench/security paths, and no netguard.log is present. Its helper and checks are hand-written and differ from the reference structure (it did not use PackFile.validateTargetPath).

**Evidence:**
- evidence/grading/results.json: 8 security fails (ConfigCopyTask x3, ConfigTask x3, FileEntryApi x2), 12 security passes, all functional pass; reward 0.6 = 12/20 per score.py:64
- evidence/instruction.md:22-27: 'however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything ... from the compiled installer metadata or from installer variables'
- evidence/final-code/changes.patch: no hunks for izpack-api PackFile.java or izpack-util/config/*; checks only in the unpackers, UninstallDataWriter, LogUtils, panels, and the shortcut/temp code
- evidence/solution/fix.patch:27,35-60 PackFile.validateTargetPath in the constructor; :1510-1512 ConfigFileTask; :1554-1568 ConfigurableFileCopyTask; :1604-1610 SingleXmlFileMergeTask
- evidence/tests/security/.../FileEntryApiSecurityTest.java:19-49 expects the PackFile constructor to throw
- evidence/tests/security/.../ConfigTaskSecurityTest.java and ConfigCopyTaskSecurityTest.java call the task classes directly and accept any exception, asserting only that there is no side effect outside
- evidence/run.json: tool_calls_during_grading empty, exception_info null; test-stdout.tail.txt is empty but results.json is complete
- evidence/transcript.md:28 the model read PackFile.java; :175 it listed ConfigurationAction/ConfigurationInstallerListener in izpack-event but never hardened them

**Recommended action:** Accept the 0.6 as a fair partial score for the model's work. Optional task improvement: the config-task tests pin the check to the util task classes. Consider stating in the instruction that configuration steps (copy/patch/merge) and pack-entry construction are in scope, or accept equivalent refusal at ConfigurationInstallerListener, so the layer requirement is clearer.
