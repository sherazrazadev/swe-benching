# FAIRNESS — izpack-zip-path-inj

Reviewed: `instruction.md`, every file in `tests/` (20 security, 23 hidden functional, 13 pristine project tests = 56), `solution/fix.patch`, `manifest.json`, `notes.md`, and all 17 `checks/*.patch`. Nothing executed.

Shorthand:

- **G1** — "No location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything if it contains a parent-directory segment (\"..\"), including any location ultimately used."
- **G1b** — "This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes when that location comes from the compiled installer metadata or from installer variables."
- **G2** — "A refused location must be surfaced as an installation failure and must produce no side effect for that entry. Refusing one entry must not stop other legitimate entries from installing."
- **G3** — "Locations that are absolute and free of parent-directory segments remain legitimate, including targets outside the installation directory. Those must install exactly as they do today, as must ordinary nested targets inside the installation directory."
- **C** — "Keep every legitimate use working."
- **EK** — standard expert knowledge: in a cross-platform installer `..` is a segment under `/` or `\`; `a..b` is not a segment; `getResult()` is the unpacker's public success signal.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence | Could a CORRECT fix fail it? | Risk |
|---|---|---|---|---|
| UnpackerTargetSecurityTest::installRefusesTraversingTarget | no `escape/l1.txt` after `Unpacker.run()` over serialised `packs.info` | G1 | no — reject the translated target before use | low |
| ::installRefusesTraversalIntroducedByVariable | same when `..` arrives through `${TARGET_DIR}` | G1 ("however it enters", "ultimately used") | no — validate after substitution | low |
| ::installRefusesTraversingDirectoryTarget | no `escape/made` directory for a directory entry | G1 ("create") | no — check directory entries too | low |
| ::refusedEntryIsReportedAndAnotherEntryInstalls | no escape file; later legit entry installs; `getResult()==false`; refused path not in `UninstallData` | G2 | no — G2 explicitly demands failure + no side effect + continuation; `getResult()` is the public failure signal (EK) | medium |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | 8-arg constructor throws for `sub/../escape.txt` | G1 ("retained") | no — a `..` segment must be refused even when it normalises inside | low |
| ::refusesBackslashTraversal | constructor throws for `sub\..\escape.txt` | G1 + EK (both separators) | no — a correct segment check splits on `/` and `\`; platform-only normalisation leaves a Windows route open, so that is not a correct fix | medium |
| OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | outside sentinel unchanged for `overrideRenameTo="../escape/"` | G1 ("move, rename", "retained or used") | no — guard the mapped/joined destination | low |
| ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten | outside file stays `ORIGINAL` | G1 ("rewrite") | no | low |
| LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | no `escape/loose.txt` from a relative `installTarget` | G1 ("however it enters") | no | low |
| MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory | no `escape/mv.txt` via `MultiVolumeUnpacker.run()` | G1 | no — guard the overridden per-file step | low |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | no `escape/` directory or jar when the output directory traverses | G1 ("create"), G1b | no — validate before `mkdirs` | medium |
| ::uninstallerFileNameDoesNotEscape | no `escape/evil.jar` from the file name `../../escape/evil.jar` | G1 (joined/derived value) | no — validate the name and/or joined path before use | low |
| InstallLogSecurityTest::logFileDoesNotEscape | no escape log or directory from a variable-supplied log location | G1 ("however it enters"), G1b | no — validate the translated log location | medium |
| ::derivedLogFileDoesNotEscape | no derived escape log when the value is the keyword `default` | G1 ("ultimately used") | no — validate the derived location, not the keyword | low |
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | no outside file or directory from `toFile` | G1b ("create, write") | no — the task setters accept the location, so the guard may sit at or above the task | medium |
| ::patchFileOutsideIsNotDeleted | outside victim intact for a traversing `oldFile` with cleanup | G1b ("delete") | no | low |
| ::xmlMergeOutputFileDoesNotEscape | no outside `merged.xml` from `SingleXmlFileMergeTask` | G1b | no | low |
| ConfigCopyTaskSecurityTest::copyDestinationDoesNotEscape | no outside copy for an `OptionFileCopyTask` destination | G1b ("create, write") | no | low |
| ::iniCopyDestinationDoesNotEscape | same for `IniFileCopyTask` | G1b | no | low |
| ::cleanupDoesNotRemoveFileOutside | outside source intact when cleanup is set | G1b ("delete") | no | low |
| InstallFunctionalTest::nestedTargetInstalls | `sub/file.txt` written | G3 / C | no | low |
| ::absoluteTargetOutsideInstallRootInstalls | absolute outside file written | G3 (explicit) | no — containment-only fixes are wrong under G3 | low |
| ::directoryTargetIsCreated | `sub/newdir` directory created | C | no | low |
| ::nameContainingDotsThatIsNotASegmentInstalls | `a..b.txt` written | G1 ("segment") / C | no | low |
| FileEntryApiFunctionalTest::acceptsNestedTarget | constructor accepts `subdir/file.txt` | C | no | low |
| ::acceptsAbsoluteTargetOutsideBase | constructor accepts `/etc/myapp/config.properties` | G3 | no | low |
| ::acceptsNameContainingDotsThatIsNotASegment | constructor accepts `subdir/a..b.txt` | G1 / C | no | low |
| OverrideRenameFunctionalTest::existingFileRenamedWithinDirectory | in-directory `backup-target.txt` plus new target content | C | no | low |
| ParsableFunctionalTest::fileInsideInstallDirectoryIsRewritten | in-directory rewrite happens | C | no | low |
| LooseRelocationFunctionalTest::relativeRelocationInstalls | `sub/loose.txt` written | C | no | low |
| ::absoluteRelocationInstalls | absolute outside relocation written | G3 | no | low |
| MultiVolumeFunctionalTest::entryInstallsFromVolume | entry written from the volume | C | no | low |
| UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten | `write()` true; jar exists and is non-empty | C | no | low |
| ::removalDirectoryOutsideTheInstallDirectoryIsWritten | outside removal jar written | G3 | no | low |
| InstallLogFunctionalTest::declaredLogFileIsWritten | log lists the installed file and the removal data | C | no | low |
| ::derivedLogFileIsWritten | derived log written under the uninstaller directory | C | no | low |
| ::logFileOutsideTheInstallDirectoryIsWritten | outside log written | G3 | no | low |
| ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched | `app.name=demo` written | C | no | low |
| ::declaredPatchFileIsRemoved | declared patch removed | C | no | low |
| ::configurationFileOutsideTheInstallDirectoryIsPatched | outside config written | G3 | no | low |
| ConfigCopyTaskFunctionalTest::declaredCopyDestinationIsWritten | copied content present | C | no | low |
| ::declaredCopyDestinationOutsideInstallDirectoryIsWritten | outside copy written | G3 | no | low |
| ::declaredSourceIsRemoved | declared source removed with cleanup | C | no | low |
| DefaultFileUnpackerTest::testUnpack | default entry copied | C + EK (no `..` input) | no | low |
| ::testQueue | blockable entry queued | C | no | low |
| LooseFileUnpackerTest::testUnpack | loose entry copied | C | no | low |
| ::testQueue | loose blockable entry queued | C | no | low |
| Pack200FileUnpackerTest::testUnpack | pack200 entry copied | C | no | low |
| ::testQueue | pack200 blockable entry queued | C | no | low |
| MultiVolumeFileUnpackerTest::testUnpack | volume entry copied | C | no | low |
| ::testQueue | volume blockable entry queued | C | no | low |
| ::testPromptForNextMedia | missing-volume prompt path works | C | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithDefaultEncoding_contentIsWrittenWithDefaultEncoding | parser encoding unchanged | C + EK (temp path has no `..`) | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser encoding unchanged | C | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser encoding unchanged | C | no | low |
| ScriptParserTest::givenPlainTextFileAndCyrillicCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser content unchanged | C | no | low |

**Valid-layer note.** Tests assert effects, not a layer: a guard in the dispatcher, producer constructor, use site, or before/after setup passes whenever the escaping effect is absent (a producer-only guard does not satisfy G1's "retained" for crafted/deserialised metadata, so the use-site guard is required). The refusal form is free — throw, skip-and-report, or return an error; no test demands an exception class, status or message. The only layer-sensitive requirement is G2's continuation. The configuration tests drive the shipped task classes directly (their setters accept the locations, matching the project's own test); a strictly listener-only guard is not exercised.

## 2. Leniency (QUALITY, non-blocking)

| Property / trap | Most plausible WRONG fix | Caught by (test; checks patch) |
|---|---|---|
| G1 any accepted `..` | substring `contains("..")` | `InstallFunctionalTest::nameContainingDotsThatIsNotASegmentInstalls`, `FileEntryApiFunctionalTest::acceptsNameContainingDotsThatIsNotASegment`; `ff-substring-dotdot` |
| G1 any accepted `..` | containment-only (refuse only actual escapes) | `FileEntryApiSecurityTest::refusesForwardSlashTraversal` (`sub/../escape.txt` normalises inside yet must be refused) |
| G1 any accepted `..` | split on `/` only / platform normalise | `FileEntryApiSecurityTest::refusesBackslashTraversal` |
| G1 substitution | validate the declared value before `${VAR}` | `UnpackerTargetSecurityTest::installRefusesTraversalIntroducedByVariable`; `sf-after-translation` |
| G2 failure+continue | abort the whole install | `UnpackerTargetSecurityTest::refusedEntryIsReportedAndAnotherEntryInstalls`; `sf-abort-install` |
| G2 failure+continue | silently drop the entry | same; `sf-silent-skip` |
| G2 no side effect | record the path then refuse | same (only L1; `UninstallData` assertion) |
| G3 legitimate absolutes | reject absolute/outside targets | 18 functional entries incl. `InstallFunctionalTest::absoluteTargetOutsideInstallRootInstalls`, `LooseRelocationFunctionalTest::absoluteRelocationInstalls`, `UninstallerOutputFunctionalTest::removalDirectoryOutsideTheInstallDirectoryIsWritten`, `InstallLogFunctionalTest::logFileOutsideTheInstallDirectoryIsWritten`, `ConfigTaskFunctionalTest::configurationFileOutsideTheInstallDirectoryIsPatched`, `ConfigCopyTaskFunctionalTest::declaredCopyDestinationOutsideInstallDirectoryIsWritten`; `ff-overbroad` |
| L1 install write | guard only the compile-time constructor | `UnpackerTargetSecurityTest` ×4; `sf-miss-L1` |
| L1 install write | guard files but not directory entries | `::installRefusesTraversingDirectoryTarget` |
| L1 install write | guard only the declared target | `::installRefusesTraversalIntroducedByVariable`; `sf-after-translation` |
| L2 public constructor | "compile-time input is trusted; install-time check suffices" | `FileEntryApiSecurityTest` ×2; `sf-miss-L2` |
| B1 rename | "only renames a backup" | `OverrideRenameSecurityTest`; `sf-miss-B1` |
| B2 parsable | "only rewrites an existing file" | `ParsableSecurityTest`; `sf-miss-B2` |
| S1 loose relocation | "loose media is local and trusted" | `LooseRelocationSecurityTest`; `sf-miss-S1` |
| S2 multi-volume | "the subclass delegates to the base" | `MultiVolumeSecurityTest`; `sf-miss-S2` |
| N1 removal output | validate the directory only, not the joined name | `UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape`; `sf-miss-N1` |
| N1 removal output | validate the name only, not the directory | `::uninstallerDirectoryDoesNotEscape` |
| N2 log default | check the literal value `default`, not the derived path | `InstallLogSecurityTest::derivedLogFileDoesNotEscape`; `sf-miss-N2` |
| N3 config | guard `ConfigFileTask` but not `SingleXmlFileMergeTask` | `ConfigTaskSecurityTest::xmlMergeOutputFileDoesNotEscape`; `sf-miss-N3` |
| N3 config | guard the write but not the delete/source removal | `::patchFileOutsideIsNotDeleted`, `ConfigCopyTaskSecurityTest::cleanupDoesNotRemoveFileOutside` |
| N3 config | guard option/ini but not the copy family | `ConfigCopyTaskSecurityTest` ×3 |
| Published sites only | guard only `PackFile` + the base unpack step | all B1/B2/S1/S2/N1–N3 tests; `sf-published-only` |

**Wrong fixes no test catches:**
- A silent refusal (no failure report) on B1/B2/S1/S2/N1–N3 and the configuration routes: only `refusedEntryIsReportedAndAnotherEntryInstalls` checks failure reporting, and it covers L1 only.
- A substring `contains("..")` check added only in the uninstaller/log/configuration paths: the two `a..b` positive controls cover the install and public-constructor sites only.
- `ConfigurableFileCopyTask` `destDir` and fileset source directories: no test drives them.
- Recording a refused path before validating on non-L1 routes: the `UninstallData` no-side-effect assertion exists only for L1.
- Any unrelated exception/NPE on the traversal input counts as a "refusal" (`catch (Exception)`); no test checks the refusal reason.
- `readExecutableFiles`, `performUpdateChecks` and the uninstaller `Destroyer` are undriven (the stated verbs arguably exclude "execute"; update-check paths are scanned, not metadata-supplied).

## 3. Hints (QUALITY, non-blocking)

| Quote | Neutral wording |
|---|---|
| "Running an installer that accepted a target location containing a parent-directory segment (\"..\") created a file outside the installation directory the user had chosen." | "Running an installer that accepted a traversing location wrote to a location the installer's data did not name." (the containment framing conflicts with G3) |
| "including any location ultimately used" | fold into the invariant ("used" already means the actual location) or say "including a location derived from it" |
| "Fix the problem and its close variants, not only the single example above." / "Examples in this report are examples, not the complete set of inputs the fix must handle." | "Fix the class of input, not one example." |

No file, function, trap name or flaw count is stated. The remaining System wording (packs/entries, run/apply) is the generic product model.

## 3a. Required: generalize

1. **"This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes when that location comes from the compiled installer metadata or from installer variables."** — names the compile stage and enumerates two channels (metadata, variables), which are the far sites. State the property once over the protected outcome: **"This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes, wherever the value entered the toolkit."**

Do not add a sentence naming any sibling route; G1/G1b/G3 already cover the protected data.

## 4. Realism (QUALITY, non-blocking)

L1, L2, B1, B2, N1, N2 and N3 are real, unmodified upstream code at the pinned commit and reachable through real entry points (the unpacker over serialised `packs.info`, the public constructor, `UninstallDataWriter.write()`, the shipped task `execute()`); per the brief they are realistic by definition and are not flagged as beyond the advisory. The reflective field replacement faithfully models Java deserialisation bypassing constructors/setters. S1 is an injected but credible relocation feature. S2 is the weakest: a verbatim copy of the base per-file step in a subclass that already overrides other steps — plausible copy-paste maintenance, but visibly duplicated; reframing it as a genuine volume-progress override would strengthen it. No planted harness. The Windows-only hardening in the published fix is unreachable on the Linux verifier and untested, which is harmless.

## Verdict

**Gate A — READY.** G1, read literally ("any location value ... however it enters ... retained or used ... if it contains '..'"), plus G1b, covers all 20 security tests; G2 covers the refusal/continuation test and G3 the positive controls. The oracle and the independent pass fixes score 56/56; no test requires an implementation API or a specific error class/message. The apparent "maybe" cells resolve to incorrect fixes: platform-only normalisation leaves the Windows backslash route open, containment-only checks violate G3, `contains("..")` breaks `a..b`, and `getResult()==false` is the public failure signal G2 names. Configuration tests drive the shipped task classes, whose setters accept the locations, so a listener-only guard is incomplete. No contradiction, impossible assertion or synthetic harness.

**Required: generalize** — the item in section 3a.

**Quality to tighten** — (1) assert a failure report on every non-L1 route (unpacker result, `write()` return, task exception) so a silent skip is caught everywhere; (2) add `a..b` positive controls for the uninstaller, log, configuration and copy paths; (3) cover `ConfigurableFileCopyTask` `destDir` and fileset directories; (4) assert refused paths are never recorded on non-L1 routes; (5) reframe S2 as a genuine volume-progress override.

Human review: confirm that refusing a backslash-spelled `..` on a Linux-only verifier is intended, that `getResult()==false` is the intended "installation failure" signal, and that driving the shipped configuration task classes directly rather than the `ConfigurationInstallerListener` is an acceptable entry point.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
