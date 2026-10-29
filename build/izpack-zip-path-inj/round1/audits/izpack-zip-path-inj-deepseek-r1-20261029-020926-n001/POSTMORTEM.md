# Post-run audit: izpack-zip-path-inj__PZFe7y2

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.5882.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

Reward 0.5882 = 10/17 security passed, 33/33 functional passed. The model's fix fully covers the pack-entry surface the instruction describes: PackFile constructor (compile/API), install-time target after variable translation, override-rename, parsable rewrite, loose installTarget relocation, multi-volume unpacker, and per-entry refusal that continues and reports failure. All 10 security tests on that surface pass, as do the dot-name positive controls and every functional test. All 7 failures come from three round-2 'trap' surfaces outside pack entries: the uninstaller output dir/name (N1), the external install-log path (N2), and the izpack-util configuration tasks (N3). The model never changed UninstallDataWriter, ConfigFileTask or SingleXmlFileMergeTask. The instruction frames 'target location' as the location each declared pack file/directory is installed to (instruction.md:5-10). It never mentions the uninstaller, the install log or configuration steps. The build notes say the broader wording that covered these surfaces ('however the value is carried, whichever installation step would use it') was removed in the fairness revision (build-notes.md:147-149 vs 255-261). The N3 tests also call library setters directly with a relative '../' File, not a value from packaged metadata. A reasonable reader could include the uninstaller path (it is packaged Info metadata used to mkdirs/write), so this is partly a model miss. Still, 7 of 17 security tests (41% of the security score) hinge on that reading, so the number understates the model's work on the stated problem. No contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | instruction-ambiguity | False | False |
| UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | instruction-ambiguity | False | False |
| InstallLogSecurityTest::logFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | instruction-ambiguity | False | False |
| ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows only source exploration of /workspace and Maven builds. One wget to repo.maven.apache.org for a Maven distribution failed (no network) and was not a fix lookup. There are no reads of hidden test paths and no visits to upstream advisory or fix URLs. run.json timing shows no tool calls during the grading window.

**Evidence:**
- evidence/grading/results.json: all 7 failures are ConfigTaskSecurityTest(3), InstallLogSecurityTest(2), UninstallerOutputSecurityTest(2); all other 10 security and all 33 functional pass
- evidence/instruction.md:5-10: 'each pack declares files and directories to install together with the location each one is installed to' frames 'target location' as pack-entry locations
- evidence/instruction.md:24-28: invariant covers 'target location value the toolkit accepts' (compile, packaged metadata, after substitution); no mention of uninstaller, log, or configuration steps
- evidence/build-notes.md:117-121: N1/N2/N3 are deliberate round-2 traps outside pack-entry handling; 'Nothing names or describes a new route' (build-notes.md:145-149)
- evidence/build-notes.md:255-261: fairness revision removed wording; the earlier 'however the value is carried, whichever installation step would use it' phrase quoted at build-notes.md:147-149 is absent from the current instruction
- evidence/build-notes.md:199-202: config-task tests drive the task classes directly rather than via metadata/listener
- evidence/tests/security/.../ConfigTaskSecurityTest.java:36-37: task.setToFile(new File(installDir, "../escape/app.properties")) set directly
- evidence/final-code/changes.patch: guards in PackFile ctor, CompilerConfig, UnpackerBase (target after translation, overrideRenameTo, parsables, executables), FileUnpacker.getTarget, LooseFileUnpacker installTarget, MultiVolumeUnpacker; per-entry refusal with skip and setResult(false)
- evidence/solution/fix.patch:87-140,1493-1564: oracle additionally guards UninstallDataWriter and ConfigFileTask/SingleXmlFileMergeTask
- evidence/transcript.md:9-10: the model's translatePath grep surfaced uninstaller-path usages but it did not pursue them

**Recommended action:** Do not report 0.5882 as a clean measure. Either (a) state in the instruction that the rule covers every location the installer writes or removes from its metadata or configuration, including installer-generated outputs and post-install configuration steps (without naming files), and rerun; or (b) report the score split, i.e. 10/10 on the stated pack-entry surface and 0/7 on the unstated N1-N3 surfaces. Consider dropping or reweighting the N3 config-task tests: they call library setters directly with a hand-built '../' path rather than a value from packaged metadata.
