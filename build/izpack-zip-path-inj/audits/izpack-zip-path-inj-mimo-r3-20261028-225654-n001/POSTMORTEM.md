# Post-run audit: izpack-zip-path-inj__MsDe8N6

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 = 9/15 security tests passed, all 31 functional tests passed (score.py:59-64). The model hardened pack-file targets (raw and after variable substitution), override-rename, loose installTarget, multi-volume, parsables, executables and the PackFile/PackInfo creation API, and all of those security tests pass. The 6 failing tests cover other carriers that the model never touched: the uninstaller output dir/file name and install-log location written by UninstallDataWriter (Info.uninstallerPath/uninstallerName, InstallerFrame.logfilePath variable), and the configuration-file task's toFile/oldFile (ConfigFileTask). The instruction puts these in scope: 'No location value ... taken from an installer's packaged metadata may be used to create, write, move, rename, rewrite or delete anything ... however the value is carried, whichever installation step would use it', and also says 'Fix the problem and its close variants'. The transcript shows the model grepped for uninstallerPath (transcript.md:100-102), then moved on without guarding it. The reference fix guards exactly these sites (fix.patch:89-140 UninstallDataWriter, 1484-1519 ConfigFileTask), so a fix that is correct and complete passes them. No contamination and no infra problems were found. Confidence is medium, not high, because grading stdout is empty, and because the ConfigTask tests drive SingleOptionFileTask directly with File objects, which is one step removed from 'packaged metadata'. Even so, both reasonably fall under the stated invariant.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::logFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only local workspace exploration and offline mvn builds (transcript.md:109-112, 189). There is no access to hidden tests and no internet fetch of the upstream fix. No netguard.log is present.

**Evidence:**
- evidence/grading/results.json:3-17 — 6 security fails, all in ConfigTask/InstallLog/UninstallerOutput; all functional tests pass
- evidence/tests/score.py:59-64 — reward = sec_ok/len(sec) when all functional tests pass (9/15 = 0.6)
- evidence/instruction.md:25-29 — 'however the value is carried, whichever installation step would use it' and 'create, write, move, rename, rewrite or delete'
- evidence/instruction.md:44 — 'Fix the problem and its close variants'
- evidence/final-code/changes.patch — touches FileUtil, PackFile, PackInfo, UnpackerBase, MultiVolumeUnpacker, LooseFileUnpacker, ScriptParser only; no UninstallDataWriter or ConfigFileTask
- evidence/transcript.md:100-102 — model grepped uninstallerPath usages, then did not act on them
- evidence/solution/fix.patch:89-140 — reference validates logfile, uninstaller dir, name and jar path in UninstallDataWriter
- evidence/solution/fix.patch:1484-1519 — reference validates toFile/oldFile/newFile in ConfigFileTask.checkAttributes
- evidence/run.json:12-20 — no tool calls during the grading window; exception_info null
- evidence/grading/test-stdout.tail.txt — empty (minor: no raw log to confirm failure messages)

**Recommended action:** Accept the 0.6 reward as a genuine partial solve: the model covered the unpacker paths but missed the uninstaller/log writer and config-task carriers. Optionally keep the grading stdout tail so future audits can confirm failure causes.
