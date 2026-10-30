# FAIRNESS — izpack-zip-path-inj

Reviewed: instruction.md, all 50 graded tests (14 security, 36 functional incl. the pristine project tests), solution/fix.patch, manifest.json, notes.md, checks/*.patch. Nothing executed.

Covering text, used in the table: **G** = invariant 1, "No location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything if it contains a parent-directory segment (".."), including any location ultimately used. This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes, wherever the value entered the toolkit." **R** = invariant 2, refusal = installation failure, no side effect, other legitimate entries keep installing. **L** = invariant 3, absolute/".."-free locations (including outside the install dir) and ordinary nested targets stay legitimate. **K** = "Keep every legitimate use working." **V** = "Fix the problem and its close variants."

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Fair because | Correct fix could fail? | Risk |
|---|---|---|---|---|
| UnpackerTargetSecurityTest::installRefusesTraversingTarget | no `escape/l1.txt` from `packs.info` target | G | no — validate the translated target before use | low |
| ::installRefusesTraversalIntroducedByVariable | same via `${TARGET_DIR}` = `…/..` | G ("including any location ultimately used") | no | low |
| ::installRefusesTraversingDirectoryTarget | no escaping directory | G ("creates") | no | low |
| ::refusedEntryIsReportedAndAnotherEntryInstalls | no escape, next entry installs "kept", `getResult()` false, refused path not recorded | R | no — must report failure, continue, and skip the refused entry's stream bytes or the next entry desynchronises; R requires it | medium |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | constructor rejects `sub/../escape.txt` | G ("retained", "however it enters") | no | low |
| ::refusesBackslashTraversal | constructor rejects `sub\..\escape.txt` | G + V + expert knowledge: an installer is cross-platform, `..` is a segment under either separator | maybe — a `Path.normalize()`-only guard on Linux treats `\` as an ordinary char and accepts it; the segment-aware fix passes | medium |
| OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | outside sentinel unchanged | G ("move, rename, delete") | no — crafted value injected reflectively, so a constructor guard is not mis-scored | low |
| ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten | outside file stays "ORIGINAL" | G ("rewrite") | no — path injected reflectively | low |
| LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | no `escape/loose.txt` from `installTarget` | G ("including any location ultimately used") | no — `additionals` injected reflectively | low |
| MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory | no `escape/mv.txt` via `MultiVolumeUnpacker.run()` | G | no | low |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | no `escape/` or jar after `write()` | G ("creates", "writes") | **maybe** — the fixture injects `"${INSTALL_PATH}/../escape"` through the real `Info.setUninstallerPath`; a correct guard refusing it where it is admitted (G: "may be retained", "however it enters") throws during fixture setup and the test errors | high |
| ::uninstallerFileNameDoesNotEscape | no `escape/evil.jar` from name `../../escape/evil.jar` | G | **maybe** — same setup-time exposure through `Info.setUninstallerName` | high |
| InstallLogSecurityTest::logFileDoesNotEscape | no escaping log/dir | G | no — a guard on generic variable assignment is not a plausible correct fix | low |
| ::derivedLogFileDoesNotEscape | no escape log for keyword `default` | G ("including any location ultimately used") | **maybe** — setup sets the escaping uninstaller path via `Info.setUninstallerPath`; a producer-side guard errors the test before the log logic | high |
| InstallFunctionalTest::nestedTargetInstalls | nested file written | L/K | no | low |
| ::absoluteTargetOutsideInstallRootInstalls | absolute outside target written | L (explicit) | no — containment-only fixes are wrong by L | low |
| ::directoryTargetIsCreated | directory entry created | K | no | low |
| ::nameContainingDotsThatIsNotASegmentInstalls | `a..b.txt` written | G ("segment") + K | no — `contains("..")` is an over-block | low |
| FileEntryApiFunctionalTest::acceptsNestedTarget | constructor accepts nested | K | no | low |
| ::acceptsAbsoluteTargetOutsideBase | accepts `/etc/...` | L | no | low |
| ::acceptsNameContainingDotsThatIsNotASegment | accepts `subdir/a..b.txt` | K | no | low |
| OverrideRenameFunctionalTest::existingFileRenamedWithinDirectory | in-dir backup rename works | K | no | low |
| ParsableFunctionalTest::fileInsideInstallDirectoryIsRewritten | in-dir rewrite works | K | no | low |
| LooseRelocationFunctionalTest::relativeRelocationInstalls | relative relocation installs | K | no | low |
| ::absoluteRelocationInstalls | absolute relocation installs | L | no | low |
| MultiVolumeFunctionalTest::entryInstallsFromVolume | multi-volume entry installs | K | no | low |
| UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten | jar written, `write()` true | K | no | low |
| ::removalDirectoryOutsideTheInstallDirectoryIsWritten | outside removal dir written | L | no | low |
| InstallLogFunctionalTest::declaredLogFileIsWritten | log lists file + jar | K | no | low |
| ::derivedLogFileIsWritten | derived log written | K | no | low |
| ::logFileOutsideTheInstallDirectoryIsWritten | outside log written | L | no | low |
| ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched | `app.name=demo` written | K | no | low |
| ::declaredPatchFileIsRemoved | declared patch removed | K | no | low |
| ::configurationFileOutsideTheInstallDirectoryIsPatched | outside config written | L | no | low |
| ConfigCopyTaskFunctionalTest::declaredCopyDestinationIsWritten | copy destination written | K | no | low |
| ::declaredCopyDestinationOutsideInstallDirectoryIsWritten | outside destination written | L | no | low |
| ::declaredSourceIsRemoved | declared source removed | K | no | low |
| LooseFileUnpackerTest::testUnpack / ::testQueue | loose copy/queue behaviour | K | no — no `..` input | low |
| DefaultFileUnpackerTest::testUnpack / ::testQueue | default copy/queue behaviour | K | no | low |
| Pack200FileUnpackerTest::testUnpack / ::testQueue | pack200 copy/queue behaviour | K | no | low |
| MultiVolumeFileUnpackerTest::testUnpack / ::testQueue | volume unpack/queue behaviour | K | no | low |
| ::testPromptForNextMedia | volume prompt behaviour | K | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithDefaultEncoding_contentIsWrittenWithDefaultEncoding | parser default encoding | K | no | low |
| ::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser UTF-8 | K | no | low |
| ::givenPlainTextFileAndSpecialCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser UTF-8 | K | no | low |
| ::givenPlainTextFileAndCyrillicCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser Cyrillic | K | no | low |

No test demands an exception class, status or message; the constructor tests accept any `Exception`, and the functional tests assert effects only.

## 2. Leniency (quality)

| Property / trap | Most plausible wrong fix | Caught by |
|---|---|---|
| G — any location | check the declared value before `${VAR}` substitution | UnpackerTargetSecurityTest::installRefusesTraversalIntroducedByVariable; `sf-after-translation.patch` |
| G — any location | guard the `PackFile` constructor only | UnpackerTargetSecurityTest ×3; `sf-miss-L1.patch` |
| G — any location | `contains("..")` instead of a segment test | dot-name controls; `ff-substring-dotdot.patch` |
| L | require containment under the install root | absolute/nested functional controls; `ff-overbroad.patch` |
| R | silently skip, no failure reported | ::refusedEntryIsReportedAndAnotherEntryInstalls; `sf-silent-skip.patch` |
| R | abort the whole install on the refused entry | same; `sf-abort-install.patch` |
| L1 install target | validate the declared path only | Variable test; `sf-after-translation.patch` |
| L2 public entry API | "compile-time input is trusted" | FileEntryApiSecurityTest ×2; `sf-miss-L2.patch` |
| B1 rename | "it only renames a backup" | OverrideRenameSecurityTest; `sf-miss-B1.patch` |
| B2 rewrite | "it only rewrites an existing file" | ParsableSecurityTest; `sf-miss-B2.patch` |
| S1 loose | "loose media is local and trusted" | LooseRelocationSecurityTest; `sf-miss-S1.patch` |
| S2 multi-volume | "the subclass delegates to the base" | MultiVolumeSecurityTest; `sf-miss-S2.patch` |
| N1 removal output | check the directory only, not the file name/joined path | ::uninstallerFileNameDoesNotEscape; `sf-miss-N1.patch` |
| N2 log | check the literal `default`, not the derived location | ::derivedLogFileDoesNotEscape; `sf-miss-N2.patch` |

Wrong fixes **no** test catches:
- Leaving the configuration-step family unguarded (`ConfigFileTask`, `SingleXmlFileMergeTask`, `ConfigurableFileCopyTask`): the N3 security tests were removed in revision 3 and only benign functional controls remain, so this real pre-existing gap is ungraded.
- Leaving `performUpdateChecks` deletions, `destroyJar()` and the uninstaller's `Destroyer` unguarded.
- Aborting the install when a B1/B2/S1/S2/N1/N2 location is refused (violates R) — no mixed-pack test on those routes; the reference fix aborts there.
- Checking only a target's parent, not its final segment (e.g. a target ending in `..`).
- Omitting the Windows-only shapes (trailing dot/space, reserved device names) — untested by design.

## 3. Hints

| Quote | Neutral rewording |
|---|---|
| "may be retained or used to create, write, move, rename, rewrite or delete anything" | "may be retained or used for any file-system operation" |
| "This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes, wherever the value entered the toolkit." | "This rule covers every location the installer uses, wherever the value entered the toolkit." |
| "including any location ultimately used" | "including the location actually used" |
| "Refusing one entry must not stop other legitimate entries from installing." | "Refusing one location must not stop other legitimate work." |

## 4. Realism

L1, L2, B1, B2, N1 and N2 are real, unmodified pinned-commit code on real entry points — realistic by definition. S1 is a credible relocation feature (magic `installTarget` key, recomputed destination) reachable through the loose path; keep. S2's copy-pasted per-file override is the weakest (a maintainer would more likely call `super`); keep, low quality. The reflection helpers faithfully model deserialised metadata.

## Verdict

**Gate A — NOT READY.** A correct fix that refuses a traversing removal-data location where it is admitted — the public `Info.setUninstallerPath`/`setUninstallerName` setters, which G covers with "may be retained … however it enters the toolkit", and which the round-0 audits required producer-API hardening to be credited for — throws inside `WriterFixture` setup, before `write()`. Score.py counts that as an error, so both `UninstallerOutputSecurityTest` cases and `InstallLogSecurityTest::derivedLogFileDoesNotEscape` fail. A setter-plus-writer fix loses; only a use-site-only fix passes. This is a harness fault, not leniency.

**Unfairness fix:** in `tests/support/.../WriterFixture.java`, set benign values through the real setters, then overwrite the uninstaller path, name and log value reflectively just before `write()` (as `InstallerFixture.target/field` does), or catch a populating-time refusal and treat it as a pass. The writer must still refuse the crafted value.

**Required: generalize** (quality, not gate a):
1. "may be retained or used to create, write, move, rename, rewrite or delete anything" — enumerates the uncovered operations (rename, rewrite, delete) → "may be retained or used for any file-system operation".
2. "This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes, wherever the value entered the toolkit." — same catalogue → "…every location the installer uses, wherever the value entered the toolkit".
3. "Refusing one entry must not stop other legitimate entries from installing." — names the pack-entry object kind → "Refusing one location must not stop other legitimate work."

**Quality to tighten:** add a mixed-pack (traversing + legitimate) test on B1/B2/S1/S2/N1/N2 so aborting those refusals is caught; re-scope security coverage for the currently ungraded configuration-step family; add a target whose final segment is `..`; state the cross-platform separator expectation so a Linux-literal guard is clearly out of bounds.

Human review: confirm that a producer-side guard on `Info.setUninstallerPath`/`setUninstallerName` must score rather than error (i.e., `WriterFixture` should inject crafted values reflectively), and confirm the backslash-separator requirement on a Linux verifier.

GATE_A: NOT_READY
NEEDS_HUMAN_REVIEW: YES
