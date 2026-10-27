# Post-run audit: uri.js-s3__mZkrjTC

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7778.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

All 8 failures (28/36 security = 0.7778) are the security/bundle cases. These load the hand-maintained minified browser build src/URI.min.js in a vm. Every other security case passes (scheme, reference, absolute fast-path, isSameOrigin comparison), and so do all 69 functional and project cases. The instruction only talks about 'the library' and never mentions a separately shipped or minified build. That build is a stale Closure artifact with no in-repo build step (build-notes.md:18-20). It even lacks isSameOrigin, so it is not a build of the current source. The model found it, reasoned about it, and left it alone. A correct, complete fix to the library source scores exactly this reward, which matches every graded run of both models landing on 0.7778. The reward measures one unstated requirement, not the quality of the security fix.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/bundle::the shipped build names the host of a location with no separator | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of a location with one separator | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of an over-separated location | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of a capitalised web scheme | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of a mixed separator run | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build names the host of an over-separated transfer location | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build resolves an over-separated reference off-site | fail | instruction-ambiguity | False | False |
| security/bundle::the shipped build resolves a back-separated reference off-site | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript has no reads of /tests or .htests, no web fetches or searches, and no use of the advisory. The model wrote its own fix and differential-fuzzed it against Node's WHATWG URL.

**Evidence:**
- grading/results.json: all 8 security/bundle::* = fail; all other 28 security and 69 functional = pass; reward 0.7778 = 28/36
- tests/support/runner.js:21 BUNDLE = src/URI.min.js; tests/support/bundle.js loads it as a <script>-style global
- instruction.md: no mention of a browser build, minified file or shipped bundle; it says only 'the host the library reports'
- build-notes.md:17-20 'shipped_build' lever: 'this revision has no in-repo step that produces it (Gruntfile is jshint only; build.js posts to a remote service)'
- build-notes.md:131 'src/URI.min.js is a stale artifact'
- transcript.md:202-204 model checks the bundle: 'isSameOrigin ABSENT ... The min bundle is already stale ... I'll leave it'
- transcript.md:186-188 no minifier is available offline (no terser)
- transcript.md:237 final note explains that src/URI.min.js was deliberately left untouched
- solution/fix.patch: the reference fix hand-edits the minified file, an edit the instruction never asks for
- run.json: tool_calls_during_grading = [], exception_info null; no infra issue

**Recommended action:** Do not count this run as a model failure. Either state in instruction.md that the shipped browser build src/URI.min.js must also report the browser's host (or that every distributed copy of the parser is in scope), or drop or down-weight the security/bundle cases. Then re-grade all runs of this task. A uniform 0.7778 across both models is a sign the requirement is unstated.
