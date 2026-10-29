# FAIRNESS — izpack-zip-path-inj (pre-trial, BUILDER.md 3h)

Reviewed: instruction.md, all 50 graded tests, solution/fix.patch, manifest.json, notes.md,
checks/*.patch, environment/injection.patch. Nothing executed.

**G** = invariant 1 ("No target location value the toolkit accepts … may be used to create, write, move,
rename, rewrite or delete anything if it contains a parent-directory segment (".."). This includes the
location ultimately used."). **R** = invariant 2 (surfaced as an installation failure; no side effect;
refusing one entry must not stop other legitimate entries). **L** = invariant 3 (absolute, ".."-free
locations, including outside the install directory, stay legitimate). **K** = "Keep every legitimate use
working." **EK** = standard expert knowledge.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| UnpackerTargetSecurityTest::installRefusesTraversingTarget | no `escape/l1.txt` after a real `Unpacker.run()` over serialised packs.info | G | no — guard the translated target before mkdir/write, at any layer above the copy | low |
| ::installRefusesTraversalIntroducedByVariable | same, ".." arrives via `${TARGET_DIR}` | G ("after configured values are substituted into it") | no — guard the post-substitution value | low |
| ::installRefusesTraversingDirectoryTarget | no `escape/made` directory for a directory entry | G ("create … anything") | no — guard before `createDirectory`; a copy-handler-only guard cannot refuse a directory | low |
| ::refusedEntryIsReportedAndAnotherEntryInstalls | no escape file; next entry installs byte-correct; `getResult()` false | R, verbatim | no — per-entry refusal that consumes the entry's bytes; aborting or silent skipping contradicts R | medium |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | `new PackFile(…,"sub/../escape.txt")` throws | G ("whether while compiling a description") | no — the compile stage is named; a use-site-only fix fails (judgement, see Human review) | medium |
| ::refusesBackslashTraversal | same for `sub\..\escape.txt` | G + EK (cross-platform validator splits both separators; the toolkit normalises `File.separatorChar`) | no, but a `/`-only split fails | medium |
| OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | outside sentinel unchanged (`overrideRenameTo="../escape/"`) | G ("move, rename") | no — guard mapped name or joined destination | low |
| ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten | outside file stays "ORIGINAL" | G ("rewrite") | no — guard the translated path before collection or parse | low |
| LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | loose `installTarget` "../escape/loose.txt" writes nothing outside | G ("location ultimately used") | no — guard the relocation value at the copy | low |
| MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory | multi-volume target with ".." writes nothing outside | G | no — the subclass's own per-file step is the layer | low |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | no `escape/` dir, no jar | G ("create") | no — guard before `mkdirs` | low |
| ::uninstallerFileNameDoesNotEscape | no `escape/evil.jar` from `../../escape/evil.jar` | G ("location ultimately used") | no — guard the name or the joined path | low |
| InstallLogSecurityTest::logFileDoesNotEscape | no escape log from the configured path | G ("after configured values are substituted") | no | low |
| ::derivedLogFileDoesNotEscape | no escape log when the value is `default` and the path is derived | G ("location ultimately used") | no — guard the derived location, not the keyword | low |
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | no file/dir outside when `toFile` escapes | G ("create") | no at task level; a listener-only guard leaves the public task unguarded and fails | medium |
| ::patchFileOutsideIsNotDeleted | outside victim intact when `oldFile` escapes with cleanup | G ("delete") | no — refusal may happen at attribute check or at deletion | low |
| ::xmlMergeOutputFileDoesNotEscape | no `merged.xml` outside | G | no | low |
| InstallFunctionalTest::nestedTargetInstalls | `install/sub/file.txt` written | L, K | no | low |
| ::absoluteTargetOutsideInstallRootInstalls | outside tree written | L ("including targets outside the installation directory") | no — a containment-only fix fails, but it contradicts L | low |
| ::directoryTargetIsCreated | `sub/newdir` created | K | no | low |
| ::nameContainingDotsThatIsNotASegmentInstalls | `a..b.txt` installed | G ("segment") | no — `contains("..")` fails, but it is wrong per G | low |
| FileEntryApiFunctionalTest::acceptsNestedTarget | `subdir/file.txt` accepted | K | no | low |
| ::acceptsAbsoluteTargetOutsideBase | `/etc/myapp/config.properties` accepted | L | no | low |
| ::acceptsNameContainingDotsThatIsNotASegment | `subdir/a..b.txt` accepted | G | no | low |
| OverrideRenameFunctionalTest::existingFileRenamedWithinDirectory | backup written, target overwritten | K | no | low |
| ParsableFunctionalTest::fileInsideInstallDirectoryIsRewritten | in-dir file rewritten | K | no | low |
| LooseRelocationFunctionalTest::relativeRelocationInstalls | `sub/loose.txt` written | K | no — dropping the feature fails here | low |
| ::absoluteRelocationInstalls | absolute relocation written | L, K | no | low |
| MultiVolumeFunctionalTest::entryInstallsFromVolume | entry written from volume | K | no | low |
| UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten | `write()` true, jar non-empty | K | no | low |
| ::removalDirectoryOutsideTheInstallDirectoryIsWritten | outside removal dir written | L | no | low |
| InstallLogFunctionalTest::declaredLogFileIsWritten | log lists file and jar | K | no | low |
| ::derivedLogFileIsWritten | derived log written | K | no | low |
| ::logFileOutsideTheInstallDirectoryIsWritten | outside log written | L | no | low |
| ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched | `app.name=demo` | K | no | low |
| ::declaredPatchFileIsRemoved | declared patch removed | K | no | low |
| ::configurationFileOutsideTheInstallDirectoryIsPatched | outside config written | L | no | low |
| DefaultFileUnpackerTest::testUnpack | entry copied | K + EK (no regression) | no — input carries no ".." | low |
| ::testQueue | blockable entry queued | K + EK | no | low |
| LooseFileUnpackerTest::testUnpack | loose copy | K | no | low |
| ::testQueue | loose blockable queued | K | no | low |
| Pack200FileUnpackerTest::testUnpack | pack200 copy | K | no | low |
| ::testQueue | pack200 blockable queued | K | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithDefaultEncoding_contentIsWrittenWithDefaultEncoding | content/encoding unchanged | K | no — guard sits in readParsableFiles, not ScriptParser | low |
| ::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | same, UTF-8 | K | no | low |
| ::givenPlainTextFileAndSpecialCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | same | K | no | low |
| ::givenPlainTextFileAndCyrillicCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | Cyrillic round-trip | K | no | low |
| MultiVolumeFileUnpackerTest::testUnpack | volume entry unpacked | K | no | low |
| ::testQueue | volume blockable queued | K | no | low |
| ::testPromptForNextMedia | missing media prompted | K | no | low |

17 security + 33 functional = 50, matching the gate runs.

## 2. Leniency (quality, non-blocking)

| Property / trap | Most plausible WRONG fix | Caught by |
|---|---|---|
| G — install write (L1) | rely on the file-entry constructor only ("metadata is deserialised") | UnpackerTargetSecurityTest ×4; `sf-miss-L1.patch` |
| G — substitution shape | validate the declared string before `${VAR}` substitution | `installRefusesTraversalIntroducedByVariable`; `sf-after-translation.patch` |
| G — compile stage (L2) | "compiler input is trusted; the install-time guard suffices" | FileEntryApiSecurityTest ×2; `sf-miss-L2.patch` |
| G — rename (B1) | "it only renames a backup" | OverrideRenameSecurityTest; `sf-miss-B1.patch` |
| G — parsable (B2) | "it only rewrites an existing file; neighbouring feature" | ParsableSecurityTest; `sf-miss-B2.patch` |
| G — loose relocation (S1) | "loose media is local and trusted" | LooseRelocationSecurityTest; `sf-miss-S1.patch` |
| G — multi-volume (S2) | "the subclass delegates to the base step" | MultiVolumeSecurityTest; `sf-miss-S2.patch` |
| G — removal output (N1) | check the directory only, not the name/joined jar | `uninstallerFileNameDoesNotEscape`; `sf-miss-N1.patch` |
| G — derived log (N2) | check the literal `default`, not the derived path | `derivedLogFileDoesNotEscape`; `sf-miss-N2.patch` |
| G — config family (N3) | guard `ConfigFileTask` only, not `SingleXmlFileMergeTask` | `xmlMergeOutputFileDoesNotEscape`; `sf-miss-N3.patch` |
| R | abort the whole install on the first refusal | `refusedEntryIsReportedAndAnotherEntryInstalls`; `sf-abort-install.patch` |
| R | silently skip without recording failure | same test (`getResult()`); `sf-silent-skip.patch` |
| G | refuse any name containing `..` | `nameContainingDotsThatIsNotASegmentInstalls`, `acceptsNameContainingDotsThatIsNotASegment`; `ff-substring-dotdot.patch` |
| L | containment under the install dir / reject absolute | 18 functional entries; `ff-overbroad.patch` |

Wrong fixes **no** test catches: refusing the write but still recording the escaping path in uninstall data
(`UninstallData` mocked; `Destroyer`, `performUpdateChecks`, `writeInstallationInformation`,
`readExecutableFiles` undriven); the configuration copy tasks and XML-merge `conffile` left unguarded;
silent refusal (no error) on B1/B2/S1/S2/N1/N2, whose tests assert effects only.

## 3. Hints (quality)

| Quote | Neutral wording |
|---|---|
| "The location came from the installer's own metadata." | delete (duplicate) |
| "This includes the location ultimately used." | fold into G (Required 1) |

No flaw count, file, function or named variant list.

## 3a. Required: generalize

1. "whether while compiling a description, from an installer's packaged metadata, or after configured values
   are substituted into it" → state once: "No target location value the toolkit accepts, however it enters
   the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything if it
   contains a parent-directory segment (".."), including any location ultimately used."
2. "it reads its packaged metadata, resolves any configured values in the declared locations, creates the
   target directories and writes each entry in place" → "When the archive runs on a user's machine, it
   applies those locations there."
3. "each pack declares files and directories to install …" → "each pack declares entries together with the
   location each one is installed to."
4. "or its compiled metadata replaced with" → "The description and the packaged metadata are data and may
   come from someone other than the person running the installer."

## 4. Realism (quality)

L1/L2/B1/B2/N1/N2/N3 are real upstream code at the pinned commit on real entry points; routes the published
fix left open are realistic by definition, not flagged. S1 is a credible relocation feature. S2 duplicates
the base per-file step near-verbatim — plausible but visible; give it a real difference or drop it. The
fixture models deserialised packs.info by reflection; the config tests bypass the listener module, so that
wiring is unexercised.

## 5. Verdict

**Gate A — READY.** Every security test is covered by G read literally: each trap is a metadata- or
configuration-derived location containing ".." used to create, write, move, rename, rewrite or delete. R is
the refusal test verbatim; no test demands an exception type, message or status; functional tests encode L
and K. Three independent fixes score 1.0, and the "maybe" cells resolve to no. No unfairness mechanism.

**Quality to tighten.** Test that refused entries are not recorded in uninstall data and that
`performUpdateChecks`/`readExecutableFiles`/`Destroyer` refuse; guard and test the configuration copy tasks
and `conffile`; require an error (not just absence) on B1/B2/S1/S2/N1/N2; replace the S2 duplicate; apply the
3a rewordings and delete the duplicated metadata sentence.

**Human review:** confirm (a) "while compiling a description" is meant to require refusal in the public
file-entry constructor, and (b) the backslash spelling on a Linux-only verifier.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
