# Post-run audit: izpack-zip-path-inj__mv6DNAL

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8667.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model hardened the PackFile constructor, the unpacker target, multi-volume, loose relocation, override-rename, parsables, executables, uninstaller/log writers, the summary logger and the install sub-path. Every unpacker, log, uninstaller, parsable, rename and file-entry security test passed, and so did all functional tests. It never touched the configuration-file tasks in izpack-util/util/config: ConfigFileTask, SingleOptionFileTask and SingleXmlFileMergeTask. Those tasks write the declared toFile and delete the oldFile/patch file, and those locations come from the installer's compiled configuration metadata. The instruction explicitly covers this: 'whichever installation step would use it' and covers 'create, write ... or delete'. So the two ConfigTaskSecurityTest failures are a real gap in coverage, not a hidden requirement. The reference fix puts its validation in ConfigFileTask.checkAttributes, which is the layer these tests exercise. A fix that validated only in a listener above the task would also fail these tests, which is why confidence is medium rather than high. That does not apply here, because the model added no config-task check at any layer. Reward 0.8667 = 13/15 security tests (all functional tests passed). No infrastructure problems or contamination were found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only workspace exploration (grep/sed/Read under /workspace) and local javac compilation. It never accessed hidden tests or the internet, and there is no netguard log.

**Evidence:**
- evidence/grading/results.json:3-4 both ConfigTaskSecurityTest cases fail; all other 13 security and all functional tests pass
- evidence/instruction.md:25-29 'No location value ... may be used to create, write, move, rename, rewrite or delete anything ... whichever installation step would use it'
- evidence/tests/security/.../ConfigTaskSecurityTest.java:35-51 sets toFile install/../escape/app.properties and expects no file or dir; :70-87 oldFile ../escape/victim.properties with cleanup must survive
- evidence/solution/fix.patch:1482-1553 reference validates toFile/oldFile/newFile in ConfigFileTask.checkAttributes and SingleXmlFileMergeTask
- evidence/final-code/changes.patch: modified files are FileUtil, PackFile, AbstractInstallDataProvider, Console/GUIPackResources, LooseFileUnpacker, UnpackerBase, MultiVolumeUnpacker, UninstallDataWriter, CompilerConfig, SummaryLoggerInstallerListener; nothing under util/config
- evidence/transcript.md:93-94 model read CompilerConfig configuration-action parsing but did not harden config tasks
- evidence/run.json timing: tool_calls_during_grading [] and agent_events_after_end 0; test-stdout.tail.txt is empty but results.json is complete

**Recommended action:** Accept the reward of 0.8667 as a fair measure. Optionally, to make the tests robust to alternative layering, consider whether the config-task tests should also accept a fix in ConfigurationInstallerListener that validates the resolved locations. That would not change this run's result.
