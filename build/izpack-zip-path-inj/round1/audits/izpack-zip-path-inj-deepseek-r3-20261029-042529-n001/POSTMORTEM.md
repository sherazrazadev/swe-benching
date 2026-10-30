# Post-run audit: izpack-zip-path-inj__E5EHAnT

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.5882.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

Reward 0.5882 = 10/17 security tests passed; all 33 functional tests passed. The agent fixed every pack-entry target-location route: the compile-time PackFile constructor and CompilerConfig, the install-time UnpackerBase check after variable translation, override-rename, parsables, LooseFileUnpacker relocation and MultiVolumeUnpacker. It used segment-aware '..' detection, so 'a..b' stays legal. A refused entry is skipped and recorded as a failure while the other entries still install. All 7 failing tests are on three surfaces outside pack entries: (1) the uninstaller output directory and file name (UninstallDataWriter), (2) the install-log location from an installer variable or the 'default' keyword (UninstallDataWriter), and (3) the izpack-util configuration-step task classes (SingleOptionFileTask/SingleXmlFileMergeTask), which the tests drive directly with File objects. The instruction's System section defines 'location' as the place each declared pack file or directory is installed to. Its observed impact is a pack-entry target containing '..'. None of the three surfaces is named or described. build-notes.md says the task author added them in round 2 as 'traps' and that 'Nothing names or describes a new route'. The fairness revision then removed the phrase 'whichever installation step would use it', which was the only wording that could have stretched 'target location' to cover them. A reasonable correct fix of the stated problem fails these tests. So the score mostly measures whether the agent guessed scope the task author held back. It does not measure whether the agent fixed the stated invariant, which the agent did well. No contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | instruction-ambiguity | False | False |
| ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| InstallLogSecurityTest::logFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| InstallLogSecurityTest::derivedLogFileDoesNotEscape | fail | instruction-ambiguity | False | False |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | fail | instruction-ambiguity | False | False |
| UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows no reads of hidden test paths (no '/tests' or 'bench/security' accesses) and no WebFetch, WebSearch, curl or code-host access. There is no netguard.log. No tool calls fell inside the grading window (run.json timing.tool_calls_during_grading = []).

**Evidence:**
- evidence/grading/results.json: the 7 failing security tests are ConfigTask x3, InstallLog x2 and UninstallerOutput x2; all other security tests and all 33 functional tests pass
- evidence/instruction.md:5-10 defines a location as where each declared pack file or directory 'is installed to'; instruction.md:18-20 gives the observed impact as a pack-entry target containing '..'
- evidence/build-notes.md:109-121 shows N1, N2 and N3 (uninstaller output, install log, config tasks) were added in round 2 as 'traps' for 'unlisted installation step' and 'different feature family in another module'
- evidence/build-notes.md:145-147 'Nothing names or describes a new route'; build-notes.md:255-261 the fairness revision then removed wording, leaving the rule tied to 'target location value'
- evidence/tests/security/.../ConfigTaskSecurityTest.java:36-42 calls task.setToFile(...) directly on the util task class, with no packaged metadata involved
- evidence/final-code/changes.patch: segment-aware FileUtil.containsParentDirectorySegment, plus checks in PackFile, CompilerConfig, UnpackerBase (raw, translated, overrideRenameTo, installTarget), FileUnpacker.getTarget, LooseFileUnpacker, MultiVolumeUnpacker and readParsableFiles; per-entry refusal continues with skip() and setResult(false)
- evidence/solution/fix.patch:87-140,1493-1564 the reference adds validateOutputPath in UninstallDataWriter and validateLocation in ConfigFileTask/SingleXmlFileMergeTask, beyond the pack-entry scope
- evidence/run.json: tool_calls_during_grading = [], exception_info = null; test-stdout.tail.txt is empty, but results.json is complete

**Recommended action:** Do not report 0.5882 as a model-capability score. Either (a) state in the instruction that the rule also covers installer-level output locations (uninstaller directory and name, install log) and configuration-step files, or (b) grade those 7 tests separately as out-of-scope hardening. Re-scored on the stated scope (pack-entry locations), this run passes every security and functional test.
