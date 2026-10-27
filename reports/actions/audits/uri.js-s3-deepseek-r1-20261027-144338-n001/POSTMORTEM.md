# Post-run audit: uri.js-s3__smP9hTm

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7778.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

Reward 0.7778 = 28/36 security + 69/69 functional. The 8 failures are all, and only, the security/bundle cases, which load src/URI.min.js (a separate minified browser build) instead of the library source. The model fixed src/URI.js fully: every scheme, reference, absolute fast-path and isSameOrigin case passes, and so does every functional and project case. It never touched URI.min.js. instruction.md never mentions a shipped/browser/minified build. It talks only about 'the host the library reports'. At this revision the min file is excluded from lint, has no in-repo build step, and is already stale relative to 1.19.6 (build-notes.md). That makes it reasonable to treat the file as a release artifact rather than code to hand-patch. The task author describes this lever as one with a built-in 'reason to dismiss'. Every graded run of both models scored exactly 0.7778, which fits an unsignalled surface better than a difficulty gradient. The model did see the file: it filtered it out with grep -v min.js and looked for a minifier. So part of the miss is the model's own, but the score mainly measures whether a solver guesses that the minified build is in scope. It does not measure the quality of the fix.

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
| security/comparison::* (3 cases) and security/absolute::* (5 cases) | pass | genuine-pass | True | True |

**Lookup or leak:** None found. No network fetches, advisory lookups or GHSA mentions appear in transcript.md. The agent's filesystem search for another URI.js copy (transcript.md:31-32) found only /workspace/src/URI.js. The hidden tests live in a separate verifier container and were never read. No tool calls happened inside the grading window (run.json timing.tool_calls_during_grading = []).

**Evidence:**
- grading/results.json: all 8 security/bundle::* fail; all other 28 security, 24 functional and 45 project cases pass
- tests/support/runner.js:21: BUNDLE = .../src/URI.min.js, loaded through tests/support/bundle.js as a script-tag global
- instruction.md: says only 'the host the library reports'; no mention of a browser, minified or shipped build
- build-notes.md lever 2 'shipped_build': 'Reason to dismiss: a build artifact that the build regenerates ... Gruntfile is jshint only'; 'src/URI.min.js is a stale artifact with respect to the 1.19.6 release notes'
- transcript.md:143: Gruntfile lint target excludes '!src/*.min.js'
- transcript.md:146: agent greps src with '| grep -v min.js' (it knew the file existed)
- transcript.md:180: 'which uglifyjs terser' found nothing (it looked into regenerating the minified build, then dropped it)
- transcript.md:183: final diff touches only src/URI.js (1 file changed)
- solution/fix.patch: the reference fix hand-edits src/URI.min.js, so the tests are satisfiable, but only by someone who decides the minified file is in scope
- Caller note: every graded run of both models scored exactly 0.7778 (= 28/36), the same bundle-only failure pattern

**Recommended action:** Do not report 0.7778 as a measured model shortfall. Fix the task in one of two ways. (a) State in instruction.md that the separately shipped browser build (src/URI.min.js) is part of the library and must hold the same invariant, then re-run. (b) Drop the bundle cases or report them as a separate metric. Under the current tests this run's src/URI.js fix earns full marks on every non-bundle case (28/28 security, 69/69 functional). The model is partly at fault for seeing the min file and not patching it, so keep that note if the task is re-scored.
