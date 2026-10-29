# Findings to fix (izpack-zip-path-inj) — owner-requested blind check on the repaired version, 2026-10-29

Treat each item like a "Required" change from the fairness review. A blind Claude Opus fix (instruction + repo only) scored 0.5 with every functional test passing; two of its failures come from task faults below.

## 1. ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten — test fault
The test plants the crafted path (`${INSTALL_PATH}/../outside.txt`) by reflection BEFORE adding the parsable to the pack. A correct fix that refuses the value at build time (the instruction: no such value "may be retained") throws during that add, so the test errors before the installer runs and fails a correct fix.
Required: plant the crafted path AFTER the parsable has been added to the pack (as the loose-relocation test does after adding the file), so the test simulates crafted compiled metadata and accepts both a build-time and an install-time refusal. Keep the assertion on the file system.

## 2. Post-install configuration steps are not stated as part of the bug — instruction fault
Six tests (configurationFileDoesNotEscape, patchFileOutsideIsNotDeleted, xmlMergeOutputFileDoesNotEscape, copyDestinationDoesNotEscape, iniCopyDestinationDoesNotEscape, cleanupDoesNotRemoveFileOutside) build the post-install configuration steps directly with an escaping location. The instruction never says these steps are part of the problem or that each step must refuse such a location itself; a fix that refuses at the point where metadata becomes step settings enforces the stated rule but fails all six.
Required: add ONE behaviour sentence to instruction.md (no names of files, classes, methods or tests), e.g.: "This includes the configuration steps the installer runs after copying files — writing, copying or merging configuration files and removing the patch or source files they use: each such step must itself refuse such a location, whatever supplied it." Keep the six tests.

## Instruction tone (owner rule)
Write instruction.md as an issue report: "In this codebase, <the exact bug and its impact>. Please fix it." State the bug, what must stop and what must keep working, plainly and completely. Never say WHERE: no file names, paths, modules, class/function/method/variable names, line numbers, test names, or counts. Keep every existing behaviour sentence; only add.

Re-gate; the oracle and pass_alt checks must still reach 1.0.
