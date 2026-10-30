# Findings to fix (izpack-zip-path-inj) — owner-requested blind check, 2026-10-30 (supersedes earlier findings)

Treat each item like a "Required" change. A blind Claude Opus fix (instruction + repo only) scored 0.5 with every functional test passing.

## 1. ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten — test fault
The test plants the crafted path (`${INSTALL_PATH}/../outside.txt`) BEFORE adding the parsable to the pack, so a correct build-time refusal ("may not be retained") makes the test error before the installer runs.
Required: plant the crafted path AFTER the parsable is added to the pack, so both a build-time and an install-time refusal pass. Assert only the file system and that nothing escaped (do not add new requirements to this test).

## 2. Post-install configuration-step tests are outside the stated bug — remove them
Six tests build the post-install configuration steps directly with an escaping location: ConfigTaskSecurityTest (configurationFileDoesNotEscape, patchFileOutsideIsNotDeleted, xmlMergeOutputFileDoesNotEscape) and ConfigCopyTaskSecurityTest (copyDestinationDoesNotEscape, iniCopyDestinationDoesNotEscape, cleanupDoesNotRemoveFileOutside). The instruction does not state that those steps are part of the bug, and a fix that enforces the stated rule where installer data becomes step settings fails all six.
Required: delete these two test classes (and any manifest traps / leak terms / check patches that exist only for them). Keep the reference fix's guards in those steps if harmless; they are no longer graded.

## 3. Restore the exact bug statement — instruction fault
A previous repair blurred "Observed impact" into "wrote to a location the installer's data did not name". Restore the exact bug: "Running an installer that accepted a target location containing a parent-directory segment ("..") created a file outside the installation directory the user had chosen." Keep the rest of the current instruction (invariants and the legitimate-use list) word for word.

## Owner rule (instruction tone)
instruction.md reads as an issue report: in this codebase, this is the exact bug and its impact, please fix it. Keep every sentence that states WHAT the bug is and WHAT must keep working. Remove only WHERE: file, path, module, class, function, method, variable, test names, line numbers.

Re-gate; oracle and pass_alt must still reach 1.0.
