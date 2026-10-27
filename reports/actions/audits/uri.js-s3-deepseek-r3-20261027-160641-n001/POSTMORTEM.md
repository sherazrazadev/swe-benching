# Post-run audit: uri.js-s3__SdkZ4to

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7778.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

Reward 0.7778 = 28/36 security tests passed, all 69 functional tests passed. All 8 failures are in the security/bundle group. That group loads the separately shipped minified browser build src/URI.min.js in a vm context (tests/support/runner.js:21, bundle.js), and the model never edited that file. The src/URI.js fix passed every scheme, reference, absolute, injected fast-path and isSameOrigin test, and the model backed it with large differential checks against WHATWG URL. instruction.md never mentions a browser build or a second copy of the parser. It only talks about 'the host the library reports'. The build notes call the minified file a 'stale artifact' with no in-repo build step, and upstream's own first fix (ac43ca8) also left it out, so a reasonable correct fix to the library source fails all 8. The model did open URI.min.js and looked for a minifier (transcript.md:63,140), so missing it is partly its own shortfall. Even so, 22% of the security score depends on an unstated deliverable, and every graded run of both models fails exactly this group. The reward therefore measures that hidden scope more than the quality of the fix.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/bundle::the shipped build names the host of a location with no separator | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build names the host of a location with one separator | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build names the host of an over-separated location | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build names the host of a capitalised web scheme | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build names the host of a mixed separator run | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build names the host of an over-separated transfer location | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build resolves an over-separated reference off-site | fail | instruction-ambiguity | False | True |
| security/bundle::the shipped build resolves a back-separated reference off-site | fail | instruction-ambiguity | False | True |
| security/{scheme,reference,absolute,comparison}::* (28 tests) | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The agent phase ran with no network. The transcript shows no internet fetch and no access to /tests or .htests. The 'Look for hidden test clues' call (transcript.md:59) only listed /workspace and git log, and the hidden suites are not in /workspace. No netguard.log is present. evidence/final-code/changes.patch is also missing; the model's diff scope comes from its own git status/diff calls in the transcript.

**Evidence:**
- grading/results.json: 8 security/bundle::* = fail, all other 28 security + 69 functional = pass; 28/36 = 0.7778
- tests/support/runner.js:21 BUNDLE = path.join(WORKSPACE,'src','URI.min.js'); bundle.js loads it like a <script> tag
- transcript.md:260-261 final status: 'M src/URI.js' only, 1 file changed
- transcript.md:63 Read /workspace/src/URI.min.js; transcript.md:140-141 'Check for available minifiers' -> none (only npm/corepack)
- instruction.md: no mention of a browser/minified build; rule is 'the host the library reports — by itself, and when it resolves a reference from a base'
- build-notes.md lever 2: 'Reason to dismiss: a build artifact that the build regenerates — this revision has no in-repo step that produces it'; 'src/URI.min.js is a stale artifact'
- task.toml difficulty_explanation names 'the separately shipped browser build' as a hidden lever; fix_commit lists upstream ac43ca8 (src only) and 6ea641c (min.js added later)
- solution/fix.patch:44-49 reference fix hand-patches src/URI.min.js parse()
- run.json: tool_calls_during_grading empty, exception_info null; no infra fault

**Recommended action:** Don't report this 0.7778 as a model shortfall. Either say in instruction.md that the project also ships a browser build (src/URI.min.js) that must follow the same rule, or drop or down-weight the 8 security/bundle tests. Then re-grade. Without the bundle group this run passes 28/28 security and 69/69 functional tests.
