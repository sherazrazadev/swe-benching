# Post-run audit: uri.js-s3__HwypzZy

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.4722.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

17/36 security tests passed and all 69 functional tests passed, so the reward is 17/36 = 0.4722. The run hit the 2h AgentTimeoutError before it finished. It fixed the scheme-delimiter parsing, the over-separated absolute fast path and isSameOrigin (all 17 of those tests pass), but it never fixed leading-separator references resolved from a base. That accounts for 11 failing tests. The instruction states this requirement explicitly: 'by itself, and when it resolves a reference from a base' and 'When a reference is not absolute, the answer is the one a browser gets'. The reference fix passes these tests without breaking functional cases, so these 11 are a genuine model failure. The run was only starting to probe this route when time ran out (transcript.md:238-239). The other 8 failures are the security/bundle tests, which load src/URI.min.js. The instruction never mentions the shipped minified build, and no in-repo step regenerates it. The other runs' 0.7778 = 28/36 fits exactly these 8 failing in every run, so the bundle tests are a task-level instruction-ambiguity, not something specific to this run. Without them this run would still be unsolved at 17/28, so the outcome 'not solved' is trustworthy but the exact reward is depressed by those 8 tests.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/reference::excess forward separators resolves to the host the browser reaches | fail | genuine-fail | True | True |
| security/reference::excess forward separators resolves to that host through the absolute form | fail | genuine-fail | True | True |
| security/reference::a pair of back separators resolves to the host the browser reaches | fail | genuine-fail | True | True |
| security/reference::a pair of back separators resolves to that host through the absolute form | fail | genuine-fail | True | True |
| security/reference::forward then back resolves to the host the browser reaches | fail | genuine-fail | True | True |
| security/reference::forward then back resolves to that host through the absolute form | fail | genuine-fail | True | True |
| security/reference::back then forward resolves to the host the browser reaches | fail | genuine-fail | True | True |
| security/reference::back then forward resolves to that host through the absolute form | fail | genuine-fail | True | True |
| security/reference::three forward separators resolves to the host the browser reaches | fail | genuine-fail | True | True |
| security/reference::three forward separators resolves to that host through the absolute form | fail | genuine-fail | True | True |
| security/reference::a resolved reference reports the host in its origin | fail | genuine-fail | True | True |
| security/bundle::the shipped build names the host of a location with no separator | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of a location with one separator | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of an over-separated location | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of a capitalised web scheme | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of a mixed separator run | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of an over-separated transfer location | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build resolves an over-separated reference off-site | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build resolves a back-separated reference off-site | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The verifier runs in a separate container and /tests is never present in the agent workspace (tests/test.sh:63-69, task.toml environment_mode=separate). The transcript shows no web fetches, no package or code-host access and no reads of hidden tests. The agent built its own oracle from Node's WHATWG URL and its own QUnit shim from the in-repo tests. It read the in-repo CHANGELOG.md, which mentions older backslash fixes; that is allowed. No netguard.log is present.

**Evidence:**
- grading/results.json: 17/36 security pass (scheme 9/9, comparison 3/3, absolute 5/5; reference 0/11, bundle 0/8); functional 69/69
- run.json: AgentTimeoutError after 7200s; tool_calls_during_grading = [] (graded code = code at timeout)
- instruction.md: 'the host the library reports — by itself, and when it resolves a reference from a base — must be the host a standards-compliant browser reaches'; 'When a reference is not absolute, the answer is the one a browser gets resolving that reference from the base'
- tests/security/cases.js:67-85 reference cases (////, \\\\, /\\, \\/, /// against https base) match WHATWG behaviour
- transcript.md:212 'src/URI.js | 96 +++... 1 file changed': URI.min.js never edited
- transcript.md:238-239: final probe shows browser sends '\\\\attacker.example/x' to attacker.example; the agent timed out before acting on it
- tests/support/runner.js:21 and tests/security/cases.js:89-119: bundle tests load src/URI.min.js; the instruction never mentions a shipped/minified build
- build-notes.md:17-20: the shipped_build lever is deliberately hidden; 'this revision has no in-repo step that produces it'
- solution/fix.patch: normalises leading separators in URI.parse, patches URI.min.js, and rewrites isSameOrigin. It is consistent with the instruction except that the bundle requirement is unstated
- Other runs 0.7778 = 28/36, consistent with every run failing exactly the 8 bundle tests

**Recommended action:** Keep this trial as unsolved (model-failed). The 11 reference failures are clearly specified and are fixable by a correct fix. Note that the 2h timeout ended the run, so if TIMEOUT_POLICY=exclude applies, exclude the trial from tallies instead of counting it as a failure. At task level, review the 8 security/bundle tests. Either state in instruction.md that the shipped browser build (src/URI.min.js) must behave the same way, or drop or reweight those tests: no run so far appears to pass them, and they depress every run's reward by 8/36.
