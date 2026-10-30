
## Owner decision (2026-10-30, delegated) on the fairness review's open questions — REPAIR
1. Test fault (Required): `WriterFixture` sets the crafted uninstaller path / name / log value through the real setters before `write()`, so a correct fix that refuses the value where it is admitted (the instruction: such a value "may [not] be retained") errors in setup and fails UninstallerOutputSecurityTest (both cases) and InstallLogSecurityTest::derivedLogFileDoesNotEscape. Fix: set benign values through the setters, then overwrite the uninstaller path, name and log value reflectively just before `write()` (as InstallerFixture.target/field does). The writer must still refuse the crafted value. A setter-side refusal and a use-site refusal must both pass.
2. Backslash separator: keep the backslash test, and state it in instruction.md with ONE behaviour sentence, e.g. "A parent-directory segment counts whichever separator the location uses, forward slash or backslash."
3. Do NOT apply the review's "Required: generalize" items 1-3. The owner's rule keeps sentences that state WHAT the bug is; the list of operations (create, write, move, rename, rewrite, delete) and "Refusing one entry must not stop other legitimate entries from installing" stay word for word.

## HARD RULE for this repair
Only the WriterFixture change (item 1) and the one added sentence (item 2). Every other line of instruction.md stays byte-for-byte unchanged; no other test changes. Re-gate; oracle and pass_alt must reach 1.0.
