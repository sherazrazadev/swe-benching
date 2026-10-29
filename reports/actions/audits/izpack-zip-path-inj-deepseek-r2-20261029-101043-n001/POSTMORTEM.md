# Post-run audit: izpack-zip-path-inj__ymyxuiF

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.5882.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.5882 (10/17 security, 33/33 functional). The model's patch is a thorough fix for pack-entry targets: a segment-aware '..' check (FileUtil.containsParentDirectorySegment) applied after variable translation in UnpackerBase, MultiVolumeUnpacker and LooseFileUnpacker (including installTarget and overrideRenameTo), the PackFile constructor, parsable/executable files, and compile-time archive entries. A refused entry is logged, marked as a failure, and skipped while the rest of the pack keeps installing. All 10 pack-entry security tests and every functional test pass, including the 'a..b' positive controls. The 7 failures are the three other places that write files to a location from the metadata: the uninstaller output directory and file name (UninstallDataWriter), the install log location, including the 'default'-derived form, and the configuration tasks (SingleOptionFileTask/SingleXmlFileMergeTask toFile/oldFile). The model left all three unguarded. The instruction's invariant covers them literally: 'No target location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything ... including any location ultimately used', and it adds 'Fix the problem and its close variants'. The model also read UninstallDataWriter's path handling (transcript.md:218-225) and chose not to guard it. The tests are simple and fair: they drive the shipped classes with a '..' value, swallow any exception, and only assert that nothing was created or deleted outside, so any reasonable guard would pass. There is some residual ambiguity: the System section talks about locations as per-pack-entry install locations, so a reader could take 'target location' to mean entry targets only. That is why confidence is medium, not high. No harness problem: no tool calls ran during the grading window and there is no exception_info. I found no sign that the agent read the hidden tests or looked up the upstream fix.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::logFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows no reads of hidden test paths and no web or advisory lookups. The one network attempt was a wget for the Apache Maven binary distribution, which failed (transcript.md:135); it was for build tooling, not the fix, and there is no netguard.log. The model's validator and its error-handling structure are its own design, not the upstream validateTargetPath.

**Evidence:**
- evidence/grading/results.json:3-15: the 7 failures are the ConfigTask (3), InstallLog (2) and UninstallerOutput (2) tests; all 33 functional tests pass
- evidence/instruction.md:22-25: 'No target location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything ... including any location ultimately used'
- evidence/instruction.md:36: 'Fix the problem and its close variants, not only the single example above.'
- evidence/final-code/changes.patch: changes only PackFile, FileUtil, CompilerConfig, MultiVolumeUnpacker, LooseFileUnpacker and UnpackerBase; it does not touch UninstallDataWriter, ConfigFileTask or SingleXmlFileMergeTask
- evidence/transcript.md:218-225: the model grepped uninstallerPath, read UninstallDataWriter lines 80-190 and 500-560 and its callers, and then left it unguarded
- evidence/tests/security/.../ConfigTaskSecurityTest.java:40-52: catches any exception and only asserts that no file or directory exists outside, so it is lenient about how a refusal is signalled
- evidence/tests/security/.../UninstallerOutputSecurityTest.java:26-34 and InstallLogSecurityTest.java:25-35: only assert that no file or directory is created outside
- evidence/build-notes.md:304-321: these routes were intentionally added as traps, and the invariant was widened to cover them after earlier audits found the wording too narrow
- evidence/run.json:12-20: tool_calls_during_grading is empty, agent_events_after_end is 0, exception_info is null
- evidence/grading/test-stdout.tail.txt is empty, but results.json is complete (50 entries) and consistent with the reward

**Recommended action:** Accept the reward as a fair measure (model-failed for the uninstaller/log/config-task routes). Optional: to remove the remaining ambiguity between 'target location' and per-entry install locations, the instruction could say that the invariant covers every location the installer writes or removes at run time, not only pack-entry targets, without naming specific routes.
