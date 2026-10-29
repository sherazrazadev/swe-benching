# Post-run audit: izpack-zip-path-inj__y5zcDAf

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7059.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.7059 = 12/17 security tests passed with all 33 functional tests passing (score.py threshold rule: all functional pass -> reward = security share). The model built a broad install-time guard: pack targets before and after substitution, overrideRenameTo and its mapped destination, parsables, loose installTarget, multi-volume, uninstaller dir/name/jar, install log including the 'default' derived path, summary log, and web temp folder. It refuses an entry with no side effects, keeps the pack stream aligned and reports failure at the end. All 12 install-time security tests pass for real. The 5 failures fall into two groups the model never patched. (1) FileEntryApiSecurityTest x2: the instruction says plainly that the rule applies to values accepted 'while compiling a description' (instruction.md:24-27). The model read CompilerConfig (transcript:39-44) but added no compile-time or PackFile-level check (changes.patch touches no izpack-api or izpack-compiler file), so PackFile accepts 'sub/../escape.txt'. (2) ConfigTaskSecurityTest x3: the model noticed the configuration step itself ('ConfigurationInstallerListener *rewrites* files at metadata locations — that's in the op list', transcript:343) but left ConfigFileTask/SingleXmlFileMergeTask unchanged. Those classes are in izpack-util, which the model was already editing and building, so the offline build was no obstacle. Both are model shortfalls under a reasonably fair grader. Some fairness concerns remain. The tests pin a layer: PackFile constructor for the compile-time case, and the task classes, not the izpack-event listener, for config. The instruction's 'target location' wording also leans toward pack entries more than config-task files. Neither changes this outcome, because the model added no guard at any layer for either surface. No contamination, no infra problems.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only local workspace exploration and offline Maven builds (mvn -o). It shows no access to the hidden tests (the bench/security or tests directories) and no fetch of the upstream advisory or fix. No netguard.log is present. run.json shows 0 agent events after agent_end and no tool calls during the grading window.

**Evidence:**
- evidence/grading/results.json: 5 security fails (ConfigTask x3, FileEntryApi x2), 12 security passes, 33/33 functional passes; reward 0.7059 = 12/17
- evidence/instruction.md:24-28: 'No target location value the toolkit accepts — whether while compiling a description, from an installer's packaged metadata, or after configured values are substituted ... may be used to create, write, move, rename, rewrite or delete anything'
- evidence/final-code/changes.patch: changes only IoHelper, UnpackerBase, MultiVolumeUnpacker, LooseFileUnpacker, GUI/ConsolePackResources and UninstallDataWriter, plus a new test; nothing in izpack-api PackFile, izpack-compiler or izpack-util config tasks
- evidence/transcript.md:39-44: model reads CompilerConfig file-adding code and adds no check
- evidence/transcript.md:343: "ConfigurationInstallerListener *rewrites* files at metadata locations — that's in the op list. Checking it:" — then no edit to the config tasks
- evidence/transcript.md:401-402: model compiles izpack-util successfully, so ConfigFileTask was fixable offline
- evidence/solution/fix.patch: oracle validates in the PackFile constructor and in ConfigFileTask.checkAttributes / SingleXmlFileMergeTask, consistent with the failing tests
- evidence/tests/security/.../FileEntryApiSecurityTest.java:19-24: drives the public PackFile constructor directly (pins the layer)
- evidence/tests/security/.../ConfigTaskSecurityTest.java: drives SingleOptionFileTask/SingleXmlFileMergeTask directly; build-notes.md:199-202 says the listener in izpack-event is not built by the verifier
- evidence/run.json: tool_calls_during_grading [] and agent_events_after_end 0; exception_info null

**Recommended action:** Accept the 0.7059 as a fair measure: the model missed the compile-time file-entry guard and the configuration-task family. Optionally, task authors could make the instruction say more clearly that non-pack-entry locations (configuration steps) count as 'target locations'. They could also accept a compile-time guard at the compiler entry point as well as the PackFile constructor, so a correct fix at a different layer is not mis-scored. Neither change affects this trial.
