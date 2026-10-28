# Post-run audit: katex-s2__cukBdJ8

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.9091.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.9091 = 20/22 security tests passed, with every functional test passing (score.py threshold formula). Both failures are in security/test_auto_render_options.spec.ts. The model made a broad prototype-pollution hardening across ~44 core src/ files (Namespace, Settings, html.ts, symbol/spacing tables, array env, etc.) but never modified contrib/auto-render/auto-render.ts. That file still builds its options copy from a plain {} and so picks up `delimiters`/`macros` planted on Object.prototype. The instruction requires the property to hold 'for every way the library consumes caller input'. auto-render ships with KaTeX (imported as katex/contrib/auto-render) and consumes caller options, and the reference fix patches exactly this file (Object.create(null) for optionsCopy). So a reasonable correct fix would pass these tests. The model's transcript shows it listed /workspace/contrib/auto-render early (transcript.md:68-71) and then never returned to it. The agent hit the 3h AgentTimeoutError, but run.json shows no tool calls inside the grading window, so the graded code is the final code. I found no evidence that the agent read the hidden tests or fetched the upstream fix. Small caveat: someone could read 'the library' as core KaTeX only, which is why confidence is medium rather than high.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/test_auto_render_options.spec.ts > auto-render takes its render options from the caller's own entries::does not take a macro table inherited from the shared prototype | fail | genuine-fail | True | True |
| security/test_auto_render_options.spec.ts > auto-render takes its render options from the caller's own entries::does not take delimiters inherited from the shared prototype | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript has no reads of /tests or the hidden test files, and no WebFetch/WebSearch, curl, GitHub or registry lookups (grep over transcript.md for these patterns returned nothing). No netguard.log is present. The agent worked from the repo source and wrote its own test file (workspace/test/prototype-pollution-spec.ts).

**Evidence:**
- evidence/grading/results.json:7-8 — the only two failing tests are both in test_auto_render_options.spec.ts; all functional tests pass (results.json:650-684 include auto-render legit tests passing)
- evidence/grading/reward.json — {"reward": 0.9091} = 20/22 security, consistent with tests/score.py:64
- evidence/final-code/changed_files.tsv — 44 files changed, all under /workspace/src or test/; contrib/auto-render/auto-render.ts not listed
- evidence/solution/fix.patch:1-22 — reference fix changes auto-render optionsCopy to Object.create(null) and reads ignoredTags from the copy
- evidence/instruction.md:29-30 — 'the property must hold for every way the library consumes caller input and its own definitions'
- evidence/tests/security/test_auto_render_options.spec.ts:10-34 — plants Object.prototype.macros / .delimiters and calls renderMathInElement with no options; asserts no PWNED / no .katex
- evidence/transcript.md:68-71 — agent enumerated /workspace/contrib/auto-render files but never edited them
- evidence/run.json timing — AgentTimeoutError at 10800s; tool_calls_during_grading: [] so graded code = final code

**Recommended action:** Accept the reward of 0.9091 as a fair measure (model-failed on auto-render coverage). Optionally make the instruction say explicitly that bundled contrib extensions such as auto-render are in scope, which would remove the residual ambiguity.
