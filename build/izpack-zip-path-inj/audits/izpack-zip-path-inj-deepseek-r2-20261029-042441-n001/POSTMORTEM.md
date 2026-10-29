# Post-run audit: izpack-zip-path-inj__JFoRbmE

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7059.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.7059 = 12/17 security tests passed, all 33 functional tests passed. The model wrote a broad, well-built fix: a segment-aware '..' check (FileUtil.containsParentDirectorySegment), install-time checks before and after variable substitution, overrideRenameTo, loose installTarget, multi-volume, parsables/executables, the uninstaller dir/name, the install log, the summary log, web temp paths, and many compile-time checks in CompilerConfig. A refused entry is skipped, its bytes are consumed and failure is reported. It missed two areas. (1) Configuration-step tasks (SingleOptionFileTask / SingleXmlFileMergeTask): the model never looked at them, so the toFile write, the oldFile cleanup delete and the XML-merge output can still escape. These 3 failures are genuine: the instruction's general rule ('may be used to create, write, ... or delete anything') covers them, and the reference fix guards them in ConfigFileTask.checkAttributes / SingleXmlFileMergeTask.validate. (2) The public PackFile constructor: the model read PackFile.java but put its compile-time checks in CompilerConfig, so `new PackFile(..., "sub/../escape.txt", ...)` is still accepted. The instruction covers values 'the toolkit accepts ... while compiling a description', which fairly covers this, but it does not name the layer. Build-notes say a fairness revision deliberately removed the sentence naming the file-entry interface. A CompilerConfig-only guard is a defensible reading, so these 2 failures carry some instruction ambiguity. Even if they were set aside, the model would still fail the 3 config-task tests, so the partial score reflects real gaps. No harness problems (no tool calls during the grading window, exception_info null) and no contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::configurationFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::patchFileOutsideIsNotDeleted | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape | fail | genuine-fail | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesForwardSlashTraversal | fail | instruction-ambiguity | True | True |
| com.izforge.izpack.installer.bench.security.FileEntryApiSecurityTest::refusesBackslashTraversal | fail | instruction-ambiguity | True | True |

**Lookup or leak:** None found. The transcript has no references to hidden test names, /tests or verifier paths, upstream or advisory. The only network attempt was a wget for a Maven distribution, which failed (transcript line 328). No netguard.log is present. The fix was derived from the code (custom helper, design different from upstream).

**Evidence:**
- evidence/grading/results.json:3-7 - 5 security failures: 3 ConfigTaskSecurityTest, 2 FileEntryApiSecurityTest; all functional pass; reward 0.7059 (12/17)
- evidence/instruction.md:24-28 - 'No target location value the toolkit accepts — whether while compiling a description, from an installer's packaged metadata, or after configured values are substituted ... may be used to create, write, move, rename, rewrite or delete anything'
- evidence/final-code/changes.patch - no hunks in izpack-util/config or izpack-api PackFile.java; compile-time checks only in CompilerConfig (lines 780-950)
- evidence/solution/fix.patch:1-60 - reference adds PackFile.validateTargetPath in constructor; :1493-1564 guards ConfigFileTask and SingleXmlFileMergeTask
- evidence/tests/security/.../FileEntryApiSecurityTest.java:19-24 - constructs PackFile directly with traversing target
- evidence/tests/security/.../ConfigTaskSecurityTest.java:36-52,71-88,118-133 - drives task classes directly
- evidence/build-notes.md:255-261 - fairness revision removed the instruction sentence naming the file-entry interface and compile stage
- evidence/build-notes.md:199-202 - config-task tests drive task classes directly; listener layer not exercised
- evidence/transcript.md:18 - model read PackFile.java; :543-567 final summary lists no config-task coverage
- evidence/run.json:12-20 - no tool calls during grading window; exception_info null

**Recommended action:** Accept the reward as a fair measure of a partial fix. The config-task misses are clear model shortfalls. Optionally flag FileEntryApiSecurityTest as layer-specific: either restore a hint that the public file-entry API counts as an accepted compile-time location, or accept equivalent compile-front-end guards. Either change would move this trial to about 0.82 at most, not to a solve.
