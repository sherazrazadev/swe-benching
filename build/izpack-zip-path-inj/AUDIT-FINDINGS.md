# Findings to fix (izpack-zip-path-inj) — owner-requested blind check, 2026-10-29

Treat each item like a "Required" change from the fairness review.

## Scope of the round-2 routes is not stated in instruction.md — instruction fault
A blind Claude Opus fix (instruction + repo only) fixed every pack-entry route and passed all functional tests, but failed exactly the 7 round-2 tests: ConfigTaskSecurityTest (configurationFileDoesNotEscape, patchFileOutsideIsNotDeleted, xmlMergeOutputFileDoesNotEscape) and UninstallerOutputSecurityTest (logFileDoesNotEscape, derivedLogFileDoesNotEscape, uninstallerDirectoryDoesNotEscape, uninstallerFileNameDoesNotEscape). DeepSeek r2 failed the same 7 and nothing else.
instruction.md defines "target location" only as a pack entry's install location ("each pack declares entries together with the location each one is installed to"). The uninstaller directory/name, the install log path and the post-install configuration-file tasks are not pack-entry locations, so a careful maintainer is not told to guard them. FAIRNESS.md already asked for human confirmation of this widened reading.

Required:
1. Widen instruction.md with ONE neutral scope sentence (do not list classes, methods or test names): the rule applies to every file-system location the installer creates, writes or deletes that comes from the compiled installer metadata or installer variables — not only pack entries, but also the installer's own outputs and the post-install steps it runs.
2. Keep that sentence honest: every site it covers must be guarded by the reference fix. Sites the reference leaves unguarded (notes list ConfigurableFileCopyTask, OptionFileCopyTask, IniFileCopyTask, readExecutableFiles, update-check deletions) must either be guarded in solution/ (with tests) or be excluded by the sentence's wording in a way that does not hint at the tested routes.
3. Do not change the 7 tests' assertions (they check behaviour only and are fair once scoped). Re-gate; the oracle and pass_alt checks must still reach 1.0.

## Instruction tone (owner rule, applies to every change above)
Write instruction.md as an issue report from the project: "In this codebase, <the exact bug and its impact>. Please fix it." State the bug, what must stop happening and what must keep working, plainly and completely, so a careful maintainer knows exactly WHAT to fix.
Never say WHERE: no file names, paths, directories, modules, class/function/method/variable names, line numbers, test names, lists of routes or variants, or counts. Describe behaviour only. Any new sentence must follow this rule; if an existing sentence breaks it, rewrite it to behaviour.
