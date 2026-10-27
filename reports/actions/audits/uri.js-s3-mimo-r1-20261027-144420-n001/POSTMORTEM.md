# Post-run audit: uri.js-s3__HCrYGBU

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7778.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.7778 = 28/36 security plus 69/69 functional. The only failures are the 8 'security/bundle' cases, which load src/URI.min.js, the shipped browser build that has its own copy of URI.parse. The model's src/URI.js fix passes every scheme, reference, absolute and comparison case. The model found the duplicate parser in URI.min.js and chose not to patch it because it could not regenerate the minified file. Hand-patching it was possible: the reference fix and upstream 6ea641c both do so. The instruction never names the browser build. It does say 'the host the library reports' for 'any string a caller supplies' and 'Fix the problem and its close variants', so this is the model's own shortfall rather than a hidden requirement. Confidence is only medium: every graded run of this task (both models) stops at exactly this lever, which suggests the instruction under-signals the minified copy.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/bundle::the shipped build names the host of a location with no separator | fail | genuine-fail | False | True |
| security/bundle::the shipped build names the host of a location with one separator | fail | genuine-fail | False | True |
| security/bundle::the shipped build names the host of an over-separated location | fail | genuine-fail | False | True |
| security/bundle::the shipped build names the host of a capitalised web scheme | fail | genuine-fail | False | True |
| security/bundle::the shipped build names the host of a mixed separator run | fail | genuine-fail | False | True |
| security/bundle::the shipped build names the host of an over-separated transfer location | fail | genuine-fail | False | True |
| security/bundle::the shipped build resolves an over-separated reference off-site | fail | genuine-fail | False | True |
| security/bundle::the shipped build resolves a back-separated reference off-site | fail | genuine-fail | False | True |

**Lookup or leak:** None found. No reads of /tests, .htests or /logs/verifier. The only /logs path read was the agent's own tool-result file (transcript.md:44-45). npm was refused by the network block (ECONNRESET). There was no fetch of the upstream advisory or fix; the model built its own WHATWG URL differential.

**Evidence:**
- grading/results.json: all 8 security/bundle::* fail; the other 28 security and all 69 functional/project cases pass; reward 0.7778 = 28/36
- tests/support/runner.js:21 BUNDLE = /workspace/src/URI.min.js; tests/support/bundle.js loads it in a vm like a <script> tag
- solution/fix.patch: patches src/URI.min.js line 38 with the same two normalisation regexes as src/URI.js, so a correct fix can pass the bundle cases
- transcript.md:241-242: model greps parse call sites and sees /workspace/src/URI.min.js:38 with the unfixed parser
- transcript.md (after Gruntfile/build.js reads): 'Min build goes through Closure Compiler in a browser — not reproducible here; tests and `main` use `src/URI.js`'
- transcript.md final: git status shows 'M src/URI.js | M test/test.js | M test/urls.js' only
- instruction.md 'The rule': 'For any string a caller supplies, the host the library reports ... must be the host a standards-compliant browser reaches'; 'Constraints': 'Fix the problem and its close variants'. The browser build is never named.
- build-notes.md lever 2 'shipped_build': the bundle was deliberately chosen as a lever with a built-in 'reason to dismiss'
- run.json timing: tool_calls_during_grading [] and agent_events_after_end 0, so no harness or timeout issue; the grading stdout tail is empty, but results.json is complete

**Recommended action:** Accept as model-failed. The score is an accurate measure of what the model did. Because every graded run of this task ends at exactly 0.7778 on the bundle lever, the task owner should consider whether the instruction should say that the library also ships a separate browser build (e.g. 'every copy of the library that ships'). Otherwise this lever mostly tests whether a model will hand-edit a minified artifact, not whether it understands the vulnerability.
