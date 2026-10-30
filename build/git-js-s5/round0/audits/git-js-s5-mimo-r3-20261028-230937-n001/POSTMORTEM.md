# Post-run audit: git-js-s5__zbiDct2

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.2593.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.2593 = 7/27 security tests passed with all functional tests passing (score.py threshold rule). The model treated the task as 'add more program-naming config keys to the deny-list'. It added trailer.<token>.cmd/command plus many other keys (browser.*, man.*, instaweb.*, guitool.*, interactive.diffFilter, difftool.*.path, gpg.ssh.defaultKeyCommand, VISUAL). That correctly closes the 7 config-write, inline -c, clone -c, --config-env and numbered-env trailer tests. It never examined the other channels the instruction explicitly puts in scope ('however the library passes that value to git', 'close variants', 'the example ... is not the full set'): packed GIT_CONFIG_PARAMETERS, config --rename-section / 'rename-section' into a trailer command section, rebase -x/--exec (including abbreviations and clusters), filter-branch --*-filter, and submodule foreach <cmd>. All 20 failures are on those channels, and the patch has no code for any of them. Even on a narrow, config-only reading of the instruction, the 6 packed-env and rename-section failures are plain config variants the model missed, so the shortfall is not just a test-scope artefact. No harness problems: results are complete, there were no tool calls inside the grading window, and there's no exception. No contamination was found. Confidence is medium, not high, because the hidden security spec (.htests/security/*.spec.mts) is not in the evidence. I can't check whether failing tests also assert a specific opt-in name such as allowUnsafeExec (unstated in the instruction), or how strict the 7 passing tests are. The model blocked none of the 20 vectors, though, so any such assertion would not change the outcome.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| caller-chosen programs through configuration > refuses a configuration supplied through the packed environment / short trailer command through packed environment / trailer command among several packed environment entries (3 tests) | fail | genuine-fail | True | True |
| caller-chosen programs through a section rename > short / expanded / alternate rename spelling into a trailer command section (3 tests) | fail | genuine-fail | True | True |
| caller-chosen programs through command options > rebase exec variants: short -x, --exec separate/embedded, abbreviation, inside quiet/interactive/three-switch clusters, attached -x value (8 tests) | fail | genuine-fail | True | True |
| caller-chosen programs through command options > history-filter option names a program / through raw argv / another history-filter option (3 tests) | fail | genuine-fail | True | True |
| caller-chosen programs through positional operands > submodule foreach command / via raw argv / alongside other options (3 tests) | fail | genuine-fail | True | True |
| caller-chosen programs through configuration > 7 trailer-command config tests (long/short key, deeper section, inline -c, clone -c, --config-env, numbered env) | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The transcript shows no access to /tests or .htests, and no web or registry lookups. The only github.com references are repo docs/changelogs the model read and a project integration test (plugin.progress) that tried to clone and failed with a TLS error. That came from running the project's own suite, not from fetching the fix. There is no netguard.log in the evidence.

**Evidence:**
- evidence/grading/results.json:3-9 — 7 trailer config tests pass
- evidence/grading/results.json:10-29 — 20 failures: packed env (3), rename-section (3), rebase exec options (8), history-filter (3), submodule foreach (3)
- evidence/grading/results.json:32-350 — all functional tests pass; reward 0.2593 = 7/27 per score.py:64
- evidence/instruction.md:19-22 — 'For every invocation the library builds ... however the library passes that value to git ... Every such value must be refused'
- evidence/instruction.md:35,39 — 'The example above is an example, not the full set.' / 'Fix the problem and its close variants.'
- evidence/final-code/changes.patch:1-55 — the only source changes are config deny-list entries and the VISUAL env var
- evidence/solution/fix.patch — reference adds GIT_CONFIG_PARAMETERS parsing, rename-section destination, rebase -x/--exec incl. abbreviations, filter-branch filters, submodule foreach, trailer keys
- evidence/tests/functional/project/argv-parser/test/parse-env.spec.ts:31 — GIT_CONFIG_PARAMETERS already gated only by allowUnsafeConfigEnvCount
- evidence/run.json timing — tool_calls_during_grading: [], exception_info: null
- evidence/transcript.md — no mention of rebase/filter-branch/foreach/GIT_CONFIG_PARAMETERS except reading CONFIG_WRITE_FLAGS (line 38)

**Recommended action:** Accept the reward as a fair measure of a partial fix: the model covered the config-key channel and missed the other channels the instruction names. Optionally include the hidden security spec in future postmortem bundles. That would confirm whether failing tests also assert a specific opt-in name (e.g. allowUnsafeExec), which the instruction does not state. It would not change this verdict, since the model blocked none of those vectors.
