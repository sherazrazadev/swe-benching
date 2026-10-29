# Post-run audit: izpack-zip-path-inj__WypbDEv

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.4706.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.4706 = 8/17 security passing with all 33 functional tests passing (score.py threshold rule). The model wrote a careful install-time fix inside the unpacker family: UnpackerBase.unpack, MultiVolumeUnpacker, LooseFileUnpacker installTarget, override-rename (including the mapped rename result), parsables and executables. Every test for those routes passes, and so do all positive controls (a..b names, absolute outside targets, nested targets). The 9 failures fall on routes the model chose not to guard. (a) The public PackFile constructor (FileEntryApiSecurityTest x2): the model explicitly decided 'nothing is validated at compile time or in constructors, since deserialization bypasses those' (transcript.md:470). The invariant says no value 'however it enters the toolkit, may be retained', so this is a stated requirement the model consciously rejected. (b) UninstallDataWriter uninstaller directory/name and install-log location (UninstallerOutput x2, InstallLog x2): the model grepped getUninstallerPath/logfile in UninstallDataWriter (transcript.md:172) but never guarded it. (c) Config-step tasks SingleOptionFileTask/SingleXmlFileMergeTask (ConfigTask x3): never examined. Routes (b) and (c) are covered only through the instruction's general wording ('No target location value the toolkit accepts, however it enters the toolkit ... create, write, move, rename, rewrite or delete anything'), which names no route. Calling the uninstaller path, log path or config output file a 'target location' is a reasonable reading but not the only one, so I hold confidence at medium. None of the tests demand a specific exception type, status or layer: each catches any Exception and checks only for on-disk side effects. Any fix that refuses '..' at those sites would pass. No infra problems: empty stdout tail, no exception_info, no tool calls during grading. No contamination was seen.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::logFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |

**Lookup or leak:** None observed. The transcript has no access to the hidden tests, /tests, the verifier paths or the bench test package, and no curl/wget/git clone/github. The model worked from the repository only (grep/Read/mvn -o). There is no netguard.log in the evidence. The model did not reproduce the upstream PackFile.validateTargetPath shape; its design (FileUtil.hasParentDirectorySegment, install-time refusal) is independent.

**Evidence:**
- evidence/grading/results.json: 8/17 security pass, 33/33 functional pass, reward 0.4706
- evidence/tests/score.py:59-64: reward is the share of security tests passing when all functional tests pass
- evidence/final-code/changes.patch: changes only FileUtil, UnpackerBase, MultiVolumeUnpacker, LooseFileUnpacker and tests. No PackFile, UninstallDataWriter, ConfigFileTask or SingleXmlFileMergeTask changes
- evidence/transcript.md:470: 'nothing is validated at compile time or in constructors, since deserialization bypasses those'
- evidence/transcript.md:172: model grepped getUninstallerPath/logfile in UninstallDataWriter, then moved on without guarding it
- evidence/instruction.md:22-25: 'No target location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything ... including any location ultimately used'
- evidence/instruction.md:36: 'Fix the problem and its close variants'
- evidence/tests/security/.../FileEntryApiSecurityTest.java:38-49 and ConfigTaskSecurityTest.java:40-47: tests accept any Exception and assert only on-disk effects, with no exact-type or layer demand
- evidence/solution/fix.patch: the reference guards PackFile constructor, UninstallDataWriter (dir, name, joined path, log), ConfigFileTask.checkAttributes and SingleXmlFileMergeTask, consistent with the tests
- evidence/run.json: tool_calls_during_grading empty, exception_info null; evidence/grading/test-stdout.tail.txt is empty (no infra error shown)

**Recommended action:** Keep the reward as a fair model-failed result (medium confidence). Optional fairness hardening: N1–N3 (uninstaller output, install log, config tasks) still rely only on the general invariant wording. If a future audit finds models routinely read 'target location' as pack-entry targets only, consider one neutral sentence saying the property applies to every location the installer writes or removes, not just pack entries. Do not name the routes.
