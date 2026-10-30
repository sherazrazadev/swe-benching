# Post-run audit: git-js-s5__Zq3nuA3

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.3704.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The reward of 0.3704 (10/27 security tests, 319/319 functional) is consistent with what the model actually did. Its patch only extended the configuration-key denylist (trailer.<token>.command/cmd plus other command-naming keys) and added section-rename destination checks. That covers levers T1 and T3, and all 10 trailer/rename security tests pass. It never examined the other caller-to-program routes: rebase -x/--exec (8 tests), filter-branch --*-filter (3), submodule foreach <command> (3), and the packed GIT_CONFIG_PARAMETERS environment (3). The transcript has no mention of rebase, filter-branch, foreach or GIT_CONFIG_PARAMETERS. Its final summary claims the guard already 'guards every channel a caller value can travel through' but lists only GIT_CONFIG_KEY_n for the environment (transcript.md:335). The instruction's required behaviour is broad: 'For every invocation the library builds ... however the library passes that value to git', and 'The example above is an example, not the full set'. A reasonable correct fix (the reference fix.patch) blocks all of these routes and passes all 27 tests. The tests are not over-specific: they check only that git was not spawned and that an Error was thrown (harness.mts:62-65), with no particular error class, message or category. One caveat lowers confidence to medium: the contract 'Values passed as ordinary arguments rather than as settings keep working' could be read as exempting the positional 'submodule foreach <cmd>' operand, which makes 3 tests mildly ambiguous. Even if those 3 were excluded, the model would still fail 14 clearly in-scope tests. The verdict is the same either way; only the exact number moves. No harness errors: results.json is complete and the agent made no tool calls during the grading window. The test stdout tail is empty but does not affect the result. No sign of contamination.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| caller-chosen programs through configuration > refuses a configuration supplied through the packed environment | fail | genuine-fail | True | True |
| caller-chosen programs through configuration > refuses a short trailer command supplied through the packed environment | fail | genuine-fail | True | True |
| caller-chosen programs through configuration > refuses a trailer command among several packed environment entries | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses the short exec option | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses the long exec option with a separate value | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses the long exec option with an embedded value | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses an unambiguous abbreviation of the long exec option | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses the exec option inside a quiet cluster | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses the exec option inside an interactive cluster | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses the exec option inside a three-switch cluster | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses an attached exec value | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses a history-filter option that names a program | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses a history-filter option reached through raw argv | fail | genuine-fail | True | True |
| caller-chosen programs through command options > refuses another history-filter option that names a program | fail | genuine-fail | True | True |
| caller-chosen programs through positional operands > refuses a command run in each submodule | fail | genuine-fail | True | True |
| caller-chosen programs through positional operands > refuses the same command reached through raw argv | fail | genuine-fail | True | True |
| caller-chosen programs through positional operands > refuses the same command alongside other options | fail | genuine-fail | True | True |

**Lookup or leak:** None observed. The transcript shows only local exploration: repo source, local git man pages and docs under /usr/share. There was no network fetch and no access to .htests or the hidden test files, and the patch is not the upstream fix (it differs in structure and scope from solution/fix.patch). No netguard.log was supplied.

**Evidence:**
- grading/results.json:10-29 - 17 security failures: 3 packed-env, 8 rebase exec, 3 filter-branch, 3 submodule foreach. All 10 trailer/rename/other-channel config tests pass. All 319 functional tests pass.
- score.py:59-64 - reward = sec_ok/len(sec) when all functional tests pass: 10/27 = 0.3704, which matches the reported reward
- final-code/changes.patch - changes only detect-vulnerable-config-writes.ts (key rows + renameTargetKeys) and analyse-config.ts (rename-section). Nothing for flag-specs, detect-vulnerable-flags, parse-env or positionals
- instruction.md:19-22 - 'For every invocation the library builds, a value supplied by the application's caller must never cause git to run a program of the caller's choosing, however the library passes that value to git'
- instruction.md:35 - 'The example above is an example, not the full set.'
- instruction.md:30-31 - 'Values passed as ordinary arguments rather than as settings keep working' (small ambiguity for the positional submodule-foreach tests)
- transcript.md:335 - model claims the denylist 'guards every channel ... (git config operands, -c/--config, --config-env, GIT_CONFIG_KEY_n)'; GIT_CONFIG_PARAMETERS is never considered
- transcript.md (grep) - no occurrences of rebase exec, filter-branch, submoduleForeach/foreach or GIT_CONFIG_PARAMETERS in the agent's exploration
- tests/support/harness.mts:62-65 - expectRefused checks only spawned===false and error instanceof Error; no category or message is required
- solution/fix.patch - reference covers rebase -x/--exec (with abbreviations), filter-branch filters, submodule foreach positional, GIT_CONFIG_PARAMETERS unpacking, rename-section, and trailer keys. Consistent with the instruction and tests
- build-notes.md:162-168 - nop gate 27/27 security fail; oracle 27/27 pass in 3 runs; per-lever miss patches behave as declared
- run.json:12-20 - no tool calls during the grading window; exception_info null
- grading/test-stdout.tail.txt - empty, but results.json is complete (27 security + 319 functional entries)

**Recommended action:** Accept the reward as a fair measure of a partial fix: the model closed the config-key and section-rename routes but missed the rebase exec, filter-branch, submodule-foreach and packed-environment routes. Optionally, the task author could clarify that 'ordinary arguments' does not include operands that name a program (affects 3 submodule-foreach tests), which would remove the remaining ambiguity.
