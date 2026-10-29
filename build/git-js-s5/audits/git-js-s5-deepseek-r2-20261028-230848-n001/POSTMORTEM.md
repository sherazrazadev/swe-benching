# Post-run audit: git-js-s5__mWXbJQM

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.3704.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** high

Reward 0.3704 = 10/27 security tests passed with all functional tests passing (score.py:58-64). The model only treated the problem as a configuration-key issue. It added trailer.<token>.cmd/command rows, plus many other config keys, and blocked rename-section targets. All 10 config and rename security tests pass for real. It never addressed four other routes the instruction covers: (1) the packed GIT_CONFIG_PARAMETERS environment (3 tests), (2) rebase -x/--exec with its abbreviation, cluster and attached forms (8 tests), (3) filter-branch --*-filter options (3 tests) and (4) submodule foreach commands (3 tests). The instruction says the guard must hold 'however the library passes that value to git', that the example 'is an example, not the full set' and to fix 'close variants'. So these routes are in scope. The tests check only that git was not spawned and that an Error was thrown, with no exact category or message demanded, and the reference fix passes them. The one real ambiguity is that 'Values passed as ordinary arguments rather than as settings keep working' could be read as exempting the submodule foreach operand. That affects only 3 of the 17 failures, so the verdict stands either way. No harness problems and no contamination.

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

**Lookup or leak:** None found. The model did not read or run evidence/tests and did not fetch the upstream fix. It searched /root, /home, /tmp and /opt for files named test|patch|solution|hidden (transcript.md:96), but only its own scratch files turned up. One npm request to registry.npmjs.org for vitest failed with ECONNRESET (transcript.md:149) and was unrelated to the fix. No netguard.log is present. All 10 security passes come from the model's own config-key and rename-section code (changes.patch:196-361).

**Evidence:**
- results.json:3-29 — 10/27 security pass, 17 fail; all functional pass; reward 0.3704 = 10/27 per score.py:58-64
- instruction.md:19-22 — 'however the library passes that value to git ... Every such value must be refused before git is started'
- instruction.md:35,39 — 'The example above is an example, not the full set'; 'Fix the problem and its close variants'
- instruction.md:30-31 — 'Values passed as ordinary arguments rather than as settings keep working' (minor ambiguity, relevant only to the submodule foreach operand)
- harness.mts:62-65 — expectRefused checks only that git was not spawned and that an Error was thrown; no category or message is demanded
- changes.patch — touches only config detection, rename-section, the config -t flag, -c disambiguation and VISUAL; no rebase, filter-branch, submodule or GIT_CONFIG_PARAMETERS handling
- transcript.md:341-366 — the model's own summary describes a config-only scope
- fix.patch:40-180 — the reference covers packed env, a rebase flag spec and guard, filter-branch filters and submodule foreach positionals, consistent with the tests
- build-notes.md:27-63 — the task's levers T1-T4 and I1-I2 match the test groups; the oracle passes 27/27
- run.json:12-19 — no tool calls during the grading window; exception_info null

**Recommended action:** Keep the reward as a fair model-failed result. Optional: reword the 'ordinary arguments keep working' contract (for example, '...that do not name a program') to remove the small ambiguity around positional operands such as submodule foreach.
