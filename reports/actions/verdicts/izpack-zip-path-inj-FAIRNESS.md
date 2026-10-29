# FAIRNESS — izpack-zip-path-inj

Reviewed: `instruction.md`, every file in `tests/` (17 security, 20 hidden functional, 13 pristine project tests = 50), `solution/fix.patch`, `manifest.json`, `notes.md`, and all 17 `checks/*.patch`. Nothing executed.

Shorthand used in the table:

- **G1** — bullet 1: "No target location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything if it contains a parent-directory segment (".."), including any location ultimately used."
- **G2** — bullet 2: "A refused location must be surfaced as an installation failure and must produce no side effect for that entry. Refusing one entry must not stop other legitimate entries from installing."
- **G3** — bullet 3: "Locations that are absolute and free of parent-directory segments remain legitimate, including targets outside the installation directory. Those must install exactly as they do today, as must ordinary nested targets inside the installation directory."
- **C** — "Keep every legitimate use working."
- **EK** — standard expert knowledge: in a cross-platform installer a parent-directory segment is delimited by either `/` or `\`; `"a..b"` is not a segment.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail it? | Risk |
|---|---|---|---|---|
| UnpackerTargetSecurityTest::installRefusesTraversingTarget | no `escape/l1.txt` after the real unpacker run | G1 | no — reject the translated target before use; any layer (loop, use site) works | low |
| ::installRefusesTraversalIntroducedByVariable | no `escape/var.txt` when `".."` arrives via `${VAR}` | G1 ("any location ultimately used") | no — validation after substitution | low |
| ::installRefusesTraversingDirectoryTarget | no `escape/made` directory | G1 ("create") | no | low |
| ::refusedEntryIsReportedAndAnotherEntryInstalls | no escape file; later legitimate entry installs; `getResult()==false` | G2 | no — G2 explicitly demands failure report + continuation; `getResult()` is the class's installation-failure signal | medium |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | public constructor throws for `sub/../escape.txt` | G1 ("however it enters", "retained") | no | low |
| ::refusesBackslashTraversal | constructor throws for `sub\..\escape.txt` | G1 + EK | no — cross-platform separator reading | medium |
| OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | outside sentinel unchanged | G1 ("move, rename"; "ultimately used") | no — guard the mapped/joined destination | low |
| ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten | outside file stays `ORIGINAL` | G1 ("rewrite") | no | low |
| LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | no `escape/loose.txt` from `installTarget` | G1 ("however it enters") | no | low |
| MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory | no `escape/mv.txt` via MultiVolumeUnpacker | G1 | no | low |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | no `escape/` dir or jar | G1 ("create"; "however it enters") | no — literal reading covers installer output locations | medium |
| ::uninstallerFileNameDoesNotEscape | no `escape/evil.jar` from the joined name | G1 (joined/derived value) | no | low |
| InstallLogSecurityTest::logFileDoesNotEscape | no escape log or dir | G1 ("however it enters") | no | medium |
| ::derivedLogFileDoesNotEscape | no derived escape log when the value is the keyword `default` | G1 ("any location ultimately used") | no | low |
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | no file/dir outside; task `execute()` throws | G1 ("however it enters"; "write/create") | no — setters are an accepted entry path | medium |
| ::patchFileOutsideIsNotDeleted | outside victim intact | G1 ("delete") | no — guard before removal is enough | low |
| ::xmlMergeOutputFileDoesNotEscape | no outside `merged.xml` | G1 | no | low |
| InstallFunctionalTest::nestedTargetInstalls | `sub/file.txt` written | G3/C | no | low |
| ::absoluteTargetOutsideInstallRootInstalls | absolute outside file written | G3 (explicit) | no — a containment-only "fix" would fail, but G3 forbids it | low |
| ::directoryTargetIsCreated | `sub/newdir` directory created | C | no | low |
| ::nameContainingDotsThatIsNotASegmentInstalls | `a..b.txt` written | G1 ("segment") + C | no | low |
| FileEntryApiFunctionalTest::acceptsNestedTarget | constructor accepts `subdir/file.txt` | C | no | low |
| ::acceptsAbsoluteTargetOutsideBase | constructor accepts `/etc/myapp/config.properties` | G3 | no | low |
| ::acceptsNameContainingDotsThatIsNotASegment | constructor accepts `subdir/a..b.txt` | G1/C | no | low |
| OverrideRenameFunctionalTest::existingFileRenamedWithinDirectory | in-dir `backup-target.txt` and new target content | C | no | low |
| ParsableFunctionalTest::fileInsideInstallDirectoryIsRewritten | in-dir rewrite happens | C | no | low |
| LooseRelocationFunctionalTest::relativeRelocationInstalls | `sub/loose.txt` written | C | no | low |
| ::absoluteRelocationInstalls | absolute outside relocation written | G3 | no | low |
| MultiVolumeFunctionalTest::entryInstallsFromVolume | entry written from volume | C | no | low |
| UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten | `write()` true; jar exists non-empty | C | no | low |
| ::removalDirectoryOutsideTheInstallDirectoryIsWritten | outside removal dir written | G3 | no | low |
| InstallLogFunctionalTest::declaredLogFileIsWritten | log lists installed file and jar | C | no | low |
| ::derivedLogFileIsWritten | derived log written | C | no | low |
| ::logFileOutsideTheInstallDirectoryIsWritten | outside log written | G3 | no | low |
| ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched | `app.name=demo` written | C | no | low |
| ::declaredPatchFileIsRemoved | declared patch removed | C | no | low |
| ::configurationFileOutsideTheInstallDirectoryIsPatched | outside config written | G3 | no | low |
| DefaultFileUnpackerTest::testUnpack | default entry copied | C | no — no `".."` input | low |
| ::testQueue | blockable entry queued | C | no | low |
| LooseFileUnpackerTest::testUnpack | loose entry copied | C | no | low |
| ::testQueue | loose blockable entry queued | C | no | low |
| Pack200FileUnpackerTest::testUnpack | pack200 entry copied | C | no | low |
| ::testQueue | pack200 blockable entry queued | C | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithDefaultEncoding_contentIsWrittenWithDefaultEncoding | parser encoding unchanged | C | no — temp path has no `".."` | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser encoding unchanged | C | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser encoding unchanged | C | no | low |
| ScriptParserTest::givenPlainTextFileAndCyrillicCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser content unchanged | C | no | low |
| MultiVolumeFileUnpackerTest::testPromptForNextMedia | missing-volume prompt path works | C | no | low |
| MultiVolumeFileUnpackerTest::testUnpack | volume entry copied | C | no | low |
| MultiVolumeFileUnpackerTest::testQueue | volume blockable entry queued | C | no | low |

No test demands a specific exception class, status, or message; refusal tests catch broadly and functional tests assert effects only.

**Valid-layer / refusal-form note.** The tests assert effects, not an implementation layer. A guard at the dispatcher loop, the producer constructor, the use site, or before/after setup passes as long as the escaping effect is absent; the only layer-sensitive requirement is G2's continuation, which a per-entry guard satisfies by reporting failure and discarding the entry's bytes (oracle, `pass-alt` and `pass-hardening` all do this and score 1.0). The refusal form is free (throw, skip-and-report, or return an error): no test demands a specific class or message. A "maybe" would arise only if the instruction's primary mechanism required a layer the tests bypass; it does not.

## 2. Leniency (QUALITY, non-blocking)

| Property / trap | Most plausible WRONG fix | Caught by |
|---|---|---|
| G1 base install write (L1) | guard only the compile-time constructor, leaving the install-time use site open | `UnpackerTargetSecurityTest` (single-entry cases) and `::refusedEntryIsReportedAndAnotherEntryInstalls`; `sf-miss-L1.patch` |
| G1 / L1 shape | validate the declared value before `${VAR}` substitution | `::installRefusesTraversalIntroducedByVariable`; `sf-after-translation.patch` |
| G1/G3 over-broad | `contains("..")`, or require relative/under-install targets, or containment-only | `InstallFunctionalTest::nameContainingDotsThatIsNotASegmentInstalls`, `FileEntryApiFunctionalTest::acceptsNameContainingDotsThatIsNotASegment`, and 18 functional entries; `ff-substring-dotdot.patch`, `ff-overbroad.patch` |
| G2 error+continue | abort the whole install on the first refusal | `::refusedEntryIsReportedAndAnotherEntryInstalls`; `sf-abort-install.patch` |
| G2 error+continue | silently drop the entry without reporting failure | `::refusedEntryIsReportedAndAnotherEntryInstalls`; `sf-silent-skip.patch` |
| L2 far site | "compile-time input is trusted; the install-time check suffices", so the public constructor stays unguarded | `FileEntryApiSecurityTest` (2); `sf-miss-L2.patch` |
| B1 rename | "only renames a backup"; leave `handleOverrideRename` | `OverrideRenameSecurityTest`; `sf-miss-B1.patch` |
| B2 parsable | "only rewrites an existing file; not a pack entry" | `ParsableSecurityTest`; `sf-miss-B2.patch` |
| S1 loose | "loose media is local and trusted" | `LooseRelocationSecurityTest`; `sf-miss-S1.patch` |
| S2 multi-volume | "the subclass delegates to the base per-file step" | `MultiVolumeSecurityTest`; `sf-miss-S2.patch` |
| N1 removal output | validate the directory only, not the name/joined jar path | `::uninstallerFileNameDoesNotEscape`; `sf-miss-N1.patch` |
| N2 log default | validate the literal value `default`, not the derived location | `::derivedLogFileDoesNotEscape`; `sf-miss-N2.patch` |
| N3 config | guard `ConfigFileTask` but not `SingleXmlFileMergeTask`, or guard the write but not the delete | `::xmlMergeOutputFileDoesNotEscape`, `::patchFileOutsideIsNotDeleted`; `sf-miss-N3.patch` |
| Published sites only | guard only `PackFile` + the base unpack step | all B1/B2/S1/S2/N1/N2/N3 tests; `sf-published-only.patch` |

**Wrong fixes no test catches (add coverage):**

- A refusal that first records the path in `UninstallData` or the install log, then refuses. The P3 test only checks the escaping file is absent; G2's "no side effect" is not asserted for the removal/install data.
- `ConfigurableFileCopyTask` / `OptionFileCopyTask` / `IniFileCopyTask`: the copy half of the configuration family is unguarded by the oracle and untested, so a fix that covers only `ConfigFileTask` and `SingleXmlFileMergeTask` passes.
- `readExecutableFiles` (executable path) and `performUpdateChecks` deletion patterns: undriven; the property's "create, write, move, rename, rewrite or delete" arguably reaches them but no test does (notes call them out of scope).
- The uninstaller's `Destroyer` deletion of recorded paths is never driven; a fix that fails to refuse a path would only be caught at install, not uninstall.
- All refusal tests use `catch (Exception expected)`, so an unrelated NPE/IO failure counts as a correct refusal; effect assertions elsewhere limit, but do not remove, this false positive.

## 3. Hints (QUALITY, non-blocking)

| Quote | Neutral wording |
|---|---|
| Title: "Installer: packaged locations" | "Installer: accepted locations" |
| "The description and the packaged metadata are data and may come from someone other than the person running the installer." | "The data the toolkit consumes may come from someone other than the person running the installer." |
| "Running an installer whose packaged metadata named a target location containing a parent-directory segment ("..") created a file outside the installation directory the user had chosen." | "Running an installer that accepted a target location containing a parent-directory segment ("..") created a file outside the installation directory the user had chosen." |
| "The toolkit compiles that description into an installer archive." | "The toolkit produces an installer from that description." |

The remaining System wording (packs/entries, run/apply) is the generic product model; it does not name a sibling or far route. "Examples in this report are examples, not the complete set" and the constraints are generic.

## 3a. Required: generalize

1. **"The toolkit compiles that description into an installer archive."** — "compiles" is the compile stage, which is exactly where the far site (public constructor) sits. Reword: **"The toolkit produces an installer from that description."**
2. **"The description and the packaged metadata are data and may come from someone other than the person running the installer."** — "packaged metadata" names the metadata channel. Reword: **"The data the toolkit consumes may come from someone other than the person running the installer."**
3. **"Running an installer whose packaged metadata named a target location containing a parent-directory segment ("..") created a file outside the installation directory the user had chosen."** — repeats the channel. Reword: **"Running an installer that accepted a target location containing a parent-directory segment ("..") created a file outside the installation directory the user had chosen."**

Do not add a sentence naming any sibling route; the general property (G1 + G3) already covers the protected data.

## 4. Realism (QUALITY, non-blocking)

L1, L2, B1, B2, N1, N2 and N3 are real, unmodified upstream code at the pinned commit, reachable through real entry points (the unpacker over serialised `packs.info`, the uninstaller-data writer, the shipped configuration task `execute()`); per the brief they are realistic by definition and must not be flagged as beyond the advisory. S1 is a plausible maintainer feature (an install-time relocation in a loose pack; the class already rebuilds its own `PackFile`). S2 is the most contrived: a verbatim copy of the base per-file step in a subclass that already overrides other steps; still plausible copy-paste maintenance, keep it. The fixtures drive real implementation code over metadata built as a crafted serialised installer (reflective field replacement faithfully models deserialisation bypassing constructors/setters); the writer and task fixtures drive the real shipped units. No planted or synthetic harness. The Windows-only published hardening is unreachable on the Linux verifier and untested, which is harmless.

## Verdict

**Gate A — READY.** Every security test is covered by G1 read literally, including the installer-output, install-log and configuration-file routes via "however it enters the toolkit", "retained or used", and "including any location ultimately used"; G2 and G3 cover the refusal/continuation and positive-control tests. The oracle and the independent `pass-alt`/`pass-hardening` fixes score 50/50; each partial check fails exactly its own trap. The three medium-risk cells (backslash spelling, `getResult()` as the failure signal, and the literal reach of "target location value" to N1–N3) are judgments, not contradictions, and the primary-mechanism fix passes every test. No unfairness.

**Required: generalize** — the three items in section 3a.

**Quality to tighten** — (1) assert the refused target is not recorded in `UninstallData`/the install log (G2 "no side effect"); (2) test or explicitly exclude the configuration copy tasks; (3) apply the neutral wordings in section 3; (4) if S2 is kept, consider reframing it as a genuine volume-progress override rather than a verbatim copy.

Human review: confirm that the widened invariant, read literally, is intended to cover uninstaller output/log and configuration-file locations (N1–N3); that a backslash-spelled `".."` must be refused on the Linux verifier; and that P3's `getResult()==false` is the intended "surfaced as an installation failure".

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
