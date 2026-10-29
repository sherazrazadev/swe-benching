# FAIRNESS — izpack-zip-path-inj

Reviewed: instruction.md, all 46 graded tests (15 security, 31 functional incl. pristine project tests), solution/fix.patch, manifest.json, notes.md, checks/*.patch. Nothing executed.

| Shorthand | Covering text in instruction.md |
|---|---|
| P1 | bullet 1 — a metadata-carried location containing a ".." segment must not be used to create, write, move, rename, rewrite or delete anything |
| P1b | "however the value is carried, whichever installation step would use it, and for the location that is actually used after the toolkit substitutes configured values into it" |
| P2 | bullet 2 — the public file-entry interface must refuse a traversing target |
| P3 | bullet 3 — refuse with an error, no side effect, other entries keep installing |
| P4 | bullet 4 — absolute, ".."-free locations, including outside the install dir, stay legitimate |
| C | "Keep every legitimate use working." |

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| UnpackerTargetSecurityTest::installRefusesTraversingTarget | no `escape/l1.txt` after `Unpacker.run()` over serialised packs.info | P1 | no — validate the translated target before use | low |
| ::installRefusesTraversalIntroducedByVariable | same for `..` introduced via `${VAR}` | P1b | no | low |
| ::installRefusesTraversingDirectoryTarget | no `escape/made` directory | P1 + P3 | no | low |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | constructor rejects `sub/../escape.txt` | P2 | no — P2's stated mechanism | low |
| ::refusesBackslashTraversal | constructor rejects `sub\..\escape.txt` | "close variants" + expert knowledge: `..` is a segment under either platform separator; installers are cross-platform | **maybe** — a split on `/` only accepts it; checked fixes split on both | medium |
| OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | outside sentinel unchanged | P1 ("move, rename") | maybe — an extra `PackFile`-constructor guard on `overrideRenameTo` throws in `pack.addFile` setup; the required use-site guard passes | medium |
| MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory | no `escape/mv.txt` via `MultiVolumeUnpacker.run()` | P1b ("whichever installation step") | no | low |
| ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten | outside file stays "ORIGINAL" | P1 ("rewrite") | maybe — a constructor guard in `ParsableFile` would throw in setup | medium |
| LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | no `escape/loose.txt` from `installTarget` | P1b ("however carried") | maybe — same if `additionals` is validated in `pack.addFile` | medium |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | no `escape/` after `write()` | P1 (create) | no — validate before `mkdirs` | low |
| ::uninstallerFileNameDoesNotEscape | no `escape/evil.jar` from name `../../escape/evil.jar` | P1 (joined path) | no | low |
| InstallLogSecurityTest::logFileDoesNotEscape | no `escape/install.log` | P1b (configured values) | no | low |
| ::derivedLogFileDoesNotEscape | no escape log when value is keyword `default` | P1b (location actually used) | no | low |
| ConfigTaskSecurityTest::configurationFileDoesNotEscape | no file/dir outside | P1 + P3 | maybe — a spec/listener-only guard (module not built) is not exercised; guarding the shipped task passes | low |
| ::patchFileOutsideIsNotDeleted | outside victim intact | P1 ("delete") | no | low |
| InstallFunctionalTest::nestedTargetInstalls | nested file written | P4 / C | no | low |
| ::absoluteTargetOutsideInstallRootInstalls | absolute outside file written | P4 (explicit) | no — containment-only fixes are wrong by P4 | low |
| ::directoryTargetIsCreated | directory entry created | C | no | low |
| OverrideRenameFunctionalTest::existingFileRenamedWithinDirectory | in-dir backup rename works | C | no | low |
| MultiVolumeFunctionalTest::entryInstallsFromVolume | multi-volume entry installs | C | no | low |
| ParsableFunctionalTest::fileInsideInstallDirectoryIsRewritten | in-dir rewrite happens | C | no | low |
| LooseRelocationFunctionalTest::relativeRelocationInstalls | relative relocation installs | C | no | low |
| ::absoluteRelocationInstalls | absolute relocation installs | P4 / C | no | low |
| UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten | jar written; `write()` true | C | no | low |
| ::removalDirectoryOutsideTheInstallDirectoryIsWritten | outside removal dir written | P4 | no | low |
| InstallLogFunctionalTest::declaredLogFileIsWritten | log lists installed file + jar | C | no | low |
| ::derivedLogFileIsWritten | derived log written | C | no | low |
| ::logFileOutsideTheInstallDirectoryIsWritten | outside log written | P4 | no | low |
| ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched | `app.name=demo` written | C | no | low |
| ::declaredPatchFileIsRemoved | declared patch removed | C | no | low |
| ::configurationFileOutsideTheInstallDirectoryIsPatched | outside config written | P4 | no | low |
| FileEntryApiFunctionalTest::acceptsNestedTarget | constructor accepts `subdir/file.txt` | C | no | low |
| ::acceptsAbsoluteTargetOutsideBase | accepts `/etc/myapp/config.properties` | P4 / P2 | no | low |
| DefaultFileUnpackerTest::testUnpack / ::testQueue | entry copied / queued | C + expert knowledge: no module regression | no | low |
| LooseFileUnpackerTest::testUnpack / ::testQueue | same, loose | C | no — no `..` input | low |
| Pack200FileUnpackerTest::testUnpack / ::testQueue | same, pack200 | C | no | low |
| ScriptParserTest::givenPlainText…DefaultEncoding / …Utf8Encoding / …Content…Utf8 / …Cyrillic…Utf8 | parser content/encoding unchanged | C | no — check sits in `readParsableFiles`, not `ScriptParser` | low |
| MultiVolumeFileUnpackerTest::testPromptForNextMedia / ::testUnpack / ::testQueue | volume/file unpacker behaviour | C | no | low |

No test demands a specific exception type, status or message; refusals are caught broadly and functional tests assert effects only.

## 2. Leniency

| Property / trap | Most plausible wrong fix | Caught by |
|---|---|---|
| P1 install write (L1) | validate the declared path before `${VAR}` substitution | UnpackerTargetSecurityTest::installRefusesTraversalIntroducedByVariable; `sf-after-translation.patch` |
| P1 (L1) | guard only the `PackFile` constructor | UnpackerTargetSecurityTest ×3; `sf-miss-L1.patch` |
| P2 (L2) | "compiler input is trusted; install-time check suffices" | FileEntryApiSecurityTest ×2; `sf-miss-L2.patch` |
| B1 rename | "only renames a backup" — leave `handleOverrideRename` | OverrideRenameSecurityTest; `sf-miss-B1.patch` |
| B2 parsable | "only rewrites an existing file" | ParsableSecurityTest; `sf-miss-B2.patch` |
| S1 loose | "loose media is local and trusted" | LooseRelocationSecurityTest; `sf-miss-S1.patch` |
| S2 multi-volume | "subclass delegates to the base" | MultiVolumeSecurityTest; `sf-miss-S2.patch` |
| N1 removal output | check the directory only, not the name/joined jar | UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape; `sf-miss-N1.patch` |
| N2 log default | check the literal value `default`, not the derived location | InstallLogSecurityTest::derivedLogFileDoesNotEscape; `sf-miss-N2.patch` |
| N3 config | "a different feature" | ConfigTaskSecurityTest ×2; `sf-miss-N3.patch` |
| P4 over-broad | require targets to be relative / under the install dir | functional install/log/removal/relocation/config tests; `ff-overbroad.patch` (17 fails, reward 0.0) |

Wrong fixes **no** test catches:
- Silent skip instead of "rejected with an error" (P3) — tests assert side effects only.
- Abort the whole install on the first traversing entry (P3's "must not stop other legitimate entries") — no pack mixes a traversing with a legitimate entry.
- Refuse any name containing `..` (`contains("..")`), breaking legitimate `a..b.txt` — no such input.
- Guard `ConfigFileTask` but not `SingleXmlFileMergeTask`; the spec parser / listener is never driven.
- Record the escaping path before validating, or leave `Destroyer`, `performUpdateChecks`, `readExecutableFiles` unguarded — `UninstallData` is mocked and those routes undriven.

## 3. Hints

| Quote | Neutral rewording |
|---|---|
| "The same rule holds when a file entry is created through the toolkit's public file-entry interface, that is, while a description is compiled into an installer: a traversing target must be refused there too." | delete; widen P1 (Required 1) |
| "for the location that is actually used after the toolkit substitutes configured values into it" | "including the location ultimately used" |
| "(for example a fixed system configuration path)" | delete |
| "no directory or file created, written, moved, rewritten or removed" | "no side effect for that entry" |
| "and was used without any check" | delete |
| Title "Installer: packaged file targets" | "Installer: packaged locations" |

## 3a. Required: generalize

1. "The same rule holds when a file entry is created through the toolkit's public file-entry interface, that is, while a description is compiled into an installer: a traversing target must be refused there too." — the only object-kind + stage sentence; exists to cover the far site. Delete it and state the property once: "No target location value the toolkit accepts — whether while compiling a description, from an installer's packaged metadata, or after configured values are substituted into it — may be used to create, write, move, rename, rewrite or delete anything if it contains a parent-directory segment (\"..\")."
2. "…including targets outside the installation directory (for example a fixed system configuration path)." — the parenthetical maps onto a hidden route. Reword to "…including targets outside the installation directory."

## 4. Realism

L1, L2, B1, B2, N1–N3 are real, unmodified code at the pinned commit, reachable through real entry points — realistic by definition. S1 is a credible relocation feature. S2 is verbatim base logic in a subclass that already overrides other steps: plausible but visibly duplicated; keep. The `target()` reflection helper faithfully models deserialised metadata.

## Verdict

**Gate A — READY.** Every security test is covered by the general property read literally, and the primary-mechanism fix (reject a `..` segment at each use site, plus refuse a traversing target in the public constructor) passes all 46 — oracle, `pass-alt` and `pass-hardening` all score 1.0. Functional tests encode P4/C; no test demands an error class. The "maybe" cells are secondary layers (producer-side guards, a listener-level config guard) that the instruction's primary mechanism does not require. No unfairness reason.

**Quality to tighten:** add an error plus mixed-pack test for P3; a legitimate `a..b.txt` case; an XML-merge case; and build rename/parsable/loose metadata without the producing constructor (set fields reflectively, as `InstallerFixture.target()` does) so a defence-in-depth guard at construction is not mis-scored as a test error.

Human review: confirm that requiring the backslash spelling of `..` on a Linux-only verifier, and expecting the use site rather than the producer constructor or configuration listener as the guard layer, are intended.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
