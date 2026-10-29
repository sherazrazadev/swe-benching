# Findings to fix (git-js-s5) — owner-requested blind check, 2026-10-29

Treat each item like a "Required" change from the fairness review.

## 1. Contract sentence contradicts the tested routes — instruction fault
instruction.md says "Values passed as ordinary arguments rather than as settings keep working." A blind Claude Opus fix read this literally and left `rebase -x/--exec`, `filter-branch --*-filter` and `submoduleForeach(cmd)` alone (17 security tests failed). The submodule-foreach tests (3) are then out of scope as written; the rebase and filter-branch tests have a literal escape. FAIRNESS.md rewording #4 already flagged this and was never applied.
Required: replace that sentence with "Values that do not name a program keep working, however they are supplied."

## 2. Opening framing is configuration-only — instruction fault
The problem statement says the value "can still be recorded in the repository's configuration as a command that a later ordinary operation runs". Nothing points at command options or operands. FAIRNESS.md #2.
Required: reword the opening so the problem is "a caller-supplied value can still cause git to run a program of the caller's choosing" (a setting, a switch or an operand), without naming commands, options or methods.

## 3. Abbreviation test demands blocking something already safe — test fault
The abbreviation test (`rebase --exe /bin/sh`) runs with `unsafe: {}`. simple-git sets GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS=true unless `unsafe.allowAbbreviatedOptions`, so real git refuses `--exe` and no program runs; a correct fix relying on the library's guard fails the test.
Required: run that test with `unsafe: { allowAbbreviatedOptions: true }` (so git really accepts the abbreviation), or remove it.

Re-gate after the changes; oracle and pass_alt must still reach 1.0.
