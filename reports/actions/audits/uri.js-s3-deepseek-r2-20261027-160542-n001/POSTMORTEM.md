# Post-run audit: uri.js-s3__KGigG29

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7778.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.7778 = 28/36 security tests, with all 69 functional/project tests passing. All 8 failures are the security/bundle cases, which load the shipped browser build src/URI.min.js. That file carries its own copy of URI.parse and still reports the base host (or none) for 'https:attacker.example', 'https://////attacker.example', '////attacker.example/x' and similar inputs. The model only edited src/URI.js (transcript: 'git status --short' -> ' M src/URI.js'). It knew URI.min.js existed: it grepped that file for isSameOrigin (transcript:51), looked for a minifier with 'which uglifyjs terser grunt' (transcript:202-203) and checked which pages load URI.min (transcript:204). It then left the file unpatched and did not mention the gap in its final report. The instruction states the invariant for 'any string a caller supplies' and 'the host the library reports', and asks for close variants to be fixed. The shipped build is part of the library a browser caller uses, and the upstream fix (6ea641c) and the reference fix both patch it. So a correct fix passes these tests, and the failures are the model's own shortfall. Confidence is medium rather than high because the instruction never names the minified copy, and the 8 bundle cases are 22% of the security weight. That explains why every graded run of both models lands at exactly 0.7778.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/bundle::the shipped build names the host of a location with no separator | fail | genuine-fail | True | True |
| security/bundle::the shipped build names the host of a location with one separator | fail | genuine-fail | True | True |
| security/bundle::the shipped build names the host of an over-separated location | fail | genuine-fail | True | True |
| security/bundle::the shipped build names the host of a capitalised web scheme | fail | genuine-fail | True | True |
| security/bundle::the shipped build names the host of a mixed separator run | fail | genuine-fail | True | True |
| security/bundle::the shipped build names the host of an over-separated transfer location | fail | genuine-fail | True | True |
| security/bundle::the shipped build resolves an over-separated reference off-site | fail | genuine-fail | True | True |
| security/bundle::the shipped build resolves a back-separated reference off-site | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The agent read only in-repo files: src/, the CHANGELOG, test/urls.js and a git log with a single 'Starting project' commit. It ran differential checks against Node's built-in WHATWG URL. Its one registry attempt, 'npm view jshint --offline', failed with ENOTCACHED (transcript:274-275), and it made no other network requests. It never touched /tests or .htests: the hidden suites are staged only at grade time, in a separate container. No netguard.log is present.

**Evidence:**
- grading/results.json: all 8 'security/bundle::*' fail and every other security test passes (28/36 = 0.7778); functional 24/24 and project 45/45 pass
- tests/support/runner.js:20 BUNDLE = src/URI.min.js, loaded via vm as a <script> would be (tests/support/bundle.js)
- transcript.md:51 the agent greps /workspace/src/URI.min.js for isSameOrigin, so it knew the file exists
- transcript.md:202-204 'which uglifyjs terser grunt' (only npm/corepack available), then checks which pages load URI.min
- transcript.md:324-325 final 'git status --short' -> ' M src/URI.js' (only file changed)
- transcript.md:326-347 final report claims zero host mismatches and never mentions the minified build
- instruction.md: 'For any string a caller supplies, the host the library reports ... must be the host a standards-compliant browser reaches' and 'Fix the problem and its close variants'
- solution/fix.patch patches src/URI.js (scheme delimiter, leading separators, isSameOrigin) and src/URI.min.js (the same two normalisation regexes), matching upstream 6ea641c, which also patched the minified copy (build-notes.md)
- run.json: tool_calls_during_grading empty; grading window about 32s; exception_info null
- grading/test-stdout.tail.txt is empty (0 bytes) and evidence/final-code/changes.patch is absent, so the final code was judged from the transcript diff and status

**Recommended action:** Accept the result as model-failed. If the task owner wants to remove the residual ambiguity, add one sentence to instruction.md noting that the library also ships a separate browser build (src/URI.min.js) that callers use directly. Also consider whether 8 of 36 security cases on one distribution artifact over-weights a single lever. Both models score exactly 0.7778 for this same reason.
