# FAIRNESS — izpack-zip-path-inj

Reviewed: `instruction.md`, all 50 graded tests (14 security, 36 functional incl. the pristine project tests), `solution/fix.patch`, `manifest.json`, `notes.md`, all 16 `checks/*.patch`. Nothing executed.

Covering text: **G** = invariant 1: "No location value the toolkit accepts, however it enters the toolkit, may be retained or used to create, write, move, rename, rewrite or delete anything if it contains a parent-directory segment (\"..\"), including any location ultimately used. This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes, wherever the value entered the toolkit." **R** = invariant 2 (refusal = installation failure, no side effect, later legitimate entries continue). **S** = invariant 3 (both separators). **L** = invariant 4 (absolute/".."-free, incl. outside the install dir, and ordinary nested targets stay legitimate). **C** = "Keep every legitimate use working."

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence | Correct fix could fail? | Risk |
|---|---|---|---|---|
| UnpackerTargetSecurityTest::installRefusesTraversingTarget | no `escape/l1.txt` after `Unpacker.run()` over serialised packs.info | G (used to create/write) | no — check the translated target at the write site | low |
| ::installRefusesTraversalIntroducedByVariable | no `escape/var.txt` when `..` comes from `${TARGET_DIR}` | G ("any location ultimately used") | no — the primary check is post-substitution; a pre-substitution check is the wrong fix (`sf-after-translation`) | low |
| ::installRefusesTraversingDirectoryTarget | no `escape/made` directory | G ("create") + R ("no side effect") | no | low |
| ::refusedEntryIsReportedAndAnotherEntryInstalls | escape absent; later entry installs "kept"; `getResult()==false`; refused path not recorded | R | no — continue + `setResult(false)` passes; abort/silent-skip fail by R (`sf-abort-install`, `sf-silent-skip`) | medium |
| FileEntryApiSecurityTest::refusesForwardSlashTraversal | public constructor throws for `sub/../escape.txt` | G ("may be retained") | no — "retained" requires refusal at acceptance; a sink-only fix is incomplete | medium |
| ::refusesBackslashTraversal | constructor throws for `sub\..\escape.txt` | S | no — S requires both separators; a platform-normalise-only guard is not following it | medium |
| OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched | outside sentinel unchanged for `overrideRenameTo="../escape/"` | G ("move, rename") | no — crafted value injected reflectively, so the sink guard is exercised; a producer-only guard is incomplete | medium |
| ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten | outside file keeps `ORIGINAL` | G ("rewrite") | no — path injected reflectively | medium |
| LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory | no `escape/loose.txt` from the `installTarget` additionals | G ("wherever the value entered") | no — additionals injected reflectively | medium |
| MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory | no `escape/mv.txt` via `MultiVolumeUnpacker.run()` | G (every location the installer writes) | no — the subclass override must be guarded | medium |
| UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape | no `escape/` dir or jar after `write()` | G (every location the installer creates/writes) | no — the writer sink guard passes; a guard only where `Info` is populated is not exercised (secondary layer) | medium |
| ::uninstallerFileNameDoesNotEscape | no `escape/evil.jar` from name `../../escape/evil.jar` | G (joined location) | no — same | medium |
| InstallLogSecurityTest::logFileDoesNotEscape | no escape log/dir from the configured log variable | G ("any location ultimately used") | no — same | medium |
| ::derivedLogFileDoesNotEscape | no derived escape log when the value is `default` and the uninstaller path traverses | G ("any location ultimately used") | no — a keyword-only check fails; the sink guard passes | medium |
| InstallFunctionalTest::nestedTargetInstalls | `sub/file.txt` written | L + C | no | low |
| ::absoluteTargetOutsideInstallRootInstalls | absolute outside target written | L (explicit) | no — containment-only fixes are wrong by L | low |
| ::directoryTargetIsCreated | `sub/newdir` created | C | no | low |
| ::nameContainingDotsThatIsNotASegmentInstalls | `a..b.txt` written | G ("segment") + C | no — `contains("..")` is an over-block | low |
| FileEntryApiFunctionalTest::acceptsNestedTarget | constructor accepts `subdir/file.txt` | L + C | no | low |
| ::acceptsAbsoluteTargetOutsideBase | constructor accepts `/etc/myapp/config.properties` | L | no | low |
| ::acceptsNameContainingDotsThatIsNotASegment | constructor accepts `subdir/a..b.txt` | G ("segment") + C | no | low |
| OverrideRenameFunctionalTest::existingFileRenamedWithinDirectory | in-dir backup rename works | C | no | low |
| ParsableFunctionalTest::fileInsideInstallDirectoryIsRewritten | in-dir rewrite works | C | no | low |
| LooseRelocationFunctionalTest::relativeRelocationInstalls | relative relocation installs | C | no | low |
| ::absoluteRelocationInstalls | absolute outside relocation installs | L | no | low |
| MultiVolumeFunctionalTest::entryInstallsFromVolume | multi-volume entry installs | C | no | low |
| UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten | jar written; `write()` true | C | no | low |
| ::removalDirectoryOutsideTheInstallDirectoryIsWritten | outside removal dir written | L | no | low |
| InstallLogFunctionalTest::declaredLogFileIsWritten | log lists installed file + removal data | C | no | low |
| ::derivedLogFileIsWritten | derived log written | C | no | low |
| ::logFileOutsideTheInstallDirectoryIsWritten | outside log written | L | no | low |
| ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched | `app.name=demo` written | C | no | low |
| ::declaredPatchFileIsRemoved | declared patch removed | C | no | low |
| ::configurationFileOutsideTheInstallDirectoryIsPatched | outside config written | L | no | low |
| ConfigCopyTaskFunctionalTest::declaredCopyDestinationIsWritten | copy destination written | C | no | low |
| ::declaredCopyDestinationOutsideInstallDirectoryIsWritten | outside destination written | L | no | low |
| ::declaredSourceIsRemoved | declared source removed with cleanup | C | no | low |
| DefaultFileUnpackerTest::testUnpack | default entry copied | C + expert knowledge (no `..` input) | no | low |
| ::testQueue | blockable entry queued | C | no | low |
| LooseFileUnpackerTest::testUnpack | loose entry copied | C | no | low |
| ::testQueue | loose blockable entry queued | C | no | low |
| Pack200FileUnpackerTest::testUnpack | pack200 entry copied | C | no | low |
| ::testQueue | pack200 blockable entry queued | C | no | low |
| ScriptParserTest::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithDefaultEncoding_contentIsWrittenWithDefaultEncoding | parser default encoding | C + expert knowledge (temp path has no `..`) | no | low |
| ::givenPlainTextFileAndSpecialCharactersInVariables_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser UTF-8 | C | no | low |
| ::givenPlainTextFileAndSpecialCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser UTF-8 | C | no | low |
| ::givenPlainTextFileAndCyrillicCharactersInContent_whenParseWithUtf8Encoding_contentIsWrittenWithUtf8Encoding | parser Cyrillic | C | no | low |
| MultiVolumeFileUnpackerTest::testPromptForNextMedia | missing-volume prompt path | C | no | low |
| ::testUnpack | volume entry copied | C | no | low |
| ::testQueue | volume blockable entry queued | C | no | low |

**Layer note.** No test demands an exception class, status or message. The fixtures inject crafted metadata reflectively (`InstallerFixture.target/field`; `WriterFixture.applyCraftedMetadata`) after benign values flow through the real producer/setters, so a producer-side guard is not mis-scored as a setup error — it is simply incomplete for deserialised metadata. The only layer-sensitive demand is the sink guard for the removal-data/log: the current `WriterFixture` never runs the installer's metadata loader, so a guard only at that load layer is bypassed. That is a secondary layer; the instruction's primary mechanism ("every file-system location the installer creates, writes, …") is the create/write site, which passes.

## 2. Leniency (quality, non-blocking)

| Property / trap | Most plausible WRONG fix | Caught by (test; check patch) |
|---|---|---|
| G any accepted `..` | substring `contains("..")` | `InstallFunctionalTest::nameContainingDotsThatIsNotASegmentInstalls`, `FileEntryApiFunctionalTest::acceptsNameContainingDotsThatIsNotASegment`; `ff-substring-dotdot` |
| G substitution | check the declared value before `${VAR}` | `UnpackerTargetSecurityTest::installRefusesTraversalIntroducedByVariable`; `sf-after-translation` |
| G any accepted `..` | containment-only (refuse only actual escapes) | `FileEntryApiSecurityTest::refusesForwardSlashTraversal` (`sub/../escape.txt` normalises inside); `ff-overbroad` over-blocks the other way |
| S both separators | split on `/` only / platform normalise | `FileEntryApiSecurityTest::refusesBackslashTraversal` |
| R failure + continue | abort the whole install | `UnpackerTargetSecurityTest::refusedEntryIsReportedAndAnotherEntryInstalls`; `sf-abort-install` |
| R failure + continue | silently drop the entry | same; `sf-silent-skip` |
| R no side effect | record the path then refuse | same (only L1) |
| L legitimate absolutes | require containment under the install root / reject absolute | 21 functional entries incl. `InstallFunctionalTest::absoluteTargetOutsideInstallRootInstalls`, `LooseRelocationFunctionalTest::absoluteRelocationInstalls`, `UninstallerOutputFunctionalTest::removalDirectoryOutsideTheInstallDirectoryIsWritten`, `InstallLogFunctionalTest::logFileOutsideTheInstallDirectoryIsWritten`, `ConfigTaskFunctionalTest::configurationFileOutsideTheInstallDirectoryIsPatched`, `ConfigCopyTaskFunctionalTest::declaredCopyDestinationOutsideInstallDirectoryIsWritten`; `ff-overbroad` |
| L1 install write | guard only the constructor / declared path | `UnpackerTargetSecurityTest` ×3 + P3; `sf-miss-L1`, `sf-after-translation` |
| L2 public constructor | "compile-time input is trusted; the install check suffices" | `FileEntryApiSecurityTest` ×2; `sf-miss-L2` |
| B1 rename | "it only renames a backup" | `OverrideRenameSecurityTest`; `sf-miss-B1` |
| B2 parsable | "it only rewrites an existing file" | `ParsableSecurityTest`; `sf-miss-B2` |
| S1 loose | "loose media is local and trusted" | `LooseRelocationSecurityTest`; `sf-miss-S1` |
| S2 multi-volume | "the subclass delegates to the base" | `MultiVolumeSecurityTest`; `sf-miss-S2` |
| N1 removal output | check the directory only, not the file name/joined path | `UninstallerOutputSecurityTest::uninstallerFileNameDoesNotEscape` (and `::uninstallerDirectoryDoesNotEscape` for the dir-only miss); `sf-miss-N1` |
| N2 log | check the literal `default`, not the derived location | `InstallLogSecurityTest::derivedLogFileDoesNotEscape`; `sf-miss-N2` |
| published sites only | guard only `PackFile` + the base unpack step | B1/B2/S1/S2/N1/N2 tests; `sf-published-only` |

Wrong fixes **no** test catches:
- Silent or non-failing refusal on B1/B2/S1/S2/N1/N2 (and the writer routes): only `refusedEntryIsReportedAndAnotherEntryInstalls` asserts failure reporting, and it covers L1 only.
- A backslash `..` at any install-time sink: only the public-constructor test covers `S`; no pack/writer/rename/parsable/loose/multi-volume vector uses `\..\`.
- Variable- or keyword-derived `..` at the non-pack sinks: only the pack target has a variable case; no test puts a variable/`default` derivation with `..` into the uninstaller path/name, log, rename, parsable, loose relocation or multi-volume target.
- Multi-segment or terminal `..` (`../../..`, `sub/..`): every vector uses one internal `..`.
- The configuration-step family (`ConfigFileTask`, `SingleXmlFileMergeTask`, `ConfigurableFileCopyTask`): the N3 security tests were removed; only benign functional controls remain. The oracle still guards them, and `manifest.verified.sites`/`task.toml` still list them.
- `readExecutableFiles`, `performUpdateChecks` deletions, `destroyJar()` and the uninstaller `Destroyer`: undriven (arguably excluded by the stated verbs/searched paths).
- A `..foo` filename (not a `..` segment) refused by an over-eager guard: no test.

## 3. Hints (quality, non-blocking)

| Quote | Neutral wording |
|---|---|
| "including any location ultimately used" | delete; "used" already denotes the location actually used (or "including a location derived from another value") |
| "A parent-directory segment counts whichever separator the location uses, forward slash or backslash." | "A parent-directory segment counts whichever separator the location uses." (drop the two-name variant list) |
| "Running an installer that accepted a target location containing a parent-directory segment (\"..\") created a file outside the installation directory the user had chosen." | keep the factual report; the containment framing can suggest a containment fix, so pair it with L (or "wrote to a location the installer's data did not name") |
| "Fix the problem and its close variants, not only the single example above." / "Examples in this report are examples, not the complete set of inputs the fix must handle." | "Fix the class of input, not one example." |

No file, function, trap name or flaw count is stated. The System wording (packs/entries, run/apply) is the generic product model, not a route list.

## 3a. Required: generalize

1. **"may be retained or used to create, write, move, rename, rewrite or delete anything"** — the operation catalogue names the operation kinds of the rename/rewrite/delete sites. State the property once: **"may be retained or used for any file-system operation"**.
2. **"This rule covers every file-system location the installer creates, writes, moves, renames, rewrites or deletes, wherever the value entered the toolkit."** — same catalogue. Reword: **"This rule covers every location the installer uses, wherever the value entered the toolkit."**
3. **"Refusing one entry must not stop other legitimate entries from installing."** — "entry" names the pack-entry object kind. Reword: **"Refusing one location must not stop other legitimate work."**

Do not add a sentence naming any route; G/L already cover the protected data.

## 4. Realism (quality, non-blocking)

L1, L2, B1, B2, N1, N2 are real, unmodified pinned-commit code on real entry points (`Unpacker.run()` over `packs.info`, the public `PackFile` constructor, `UninstallDataWriter.write()`); the published fix left B1/B2/N1/N2 open, and current upstream still does. Realistic by definition; not flagged as beyond the advisory. S1 is an injected but credible relocation feature (magic `installTarget`, recomputed destination) reachable through the loose path; keep. S2 is the weakest: a verbatim copy of the base per-file step in a subclass that already overrides other steps — plausible copy-paste maintenance, but visibly duplicated; reframing it as a genuine volume-progress override would strengthen it. The reflection helpers faithfully model deserialised metadata; `WriterFixture` now injects the crafted `Info` values reflectively, so the round-4 setup-time exposure is fixed. The Windows-only hardening (trailing dot/space, reserved names) is unreachable on Linux and untested; harmless.

## 5. Verdict

**Gate A — READY.** G, read literally, covers every security test: it names no route, and its sink clause reaches the removal-data, log, rename, parsable, loose and multi-volume sites. The primary-mechanism fix — a segment-aware refusal at each create/write site plus refusal at the public constructor because the value would otherwise be "retained" — passes all 50 (oracle, `pass-alt`, `pass-hardening` 1.0; nop 14 fail / 36 pass). The "maybe" rows are secondary layers: a guard only where installer metadata is loaded/populated is not exercised by `WriterFixture`, and a producer-only constructor/setter guard is incomplete under "wherever the value entered the toolkit". Because the instruction's primary mechanism is the create/write site, the PRIMARY-MECHANISM rule puts these under quality, not unfairness. No test demands an error class/status; `getResult()==false` is the unpacker's public failure signal, and the writer's existing boolean/catch path is the existing surface. No contradiction, impossible assertion or synthetic harness.

**Required: generalize** — the three items in 3a.

**Quality to tighten** — (1) add mixed-entry/refusal-surface assertions on B1/B2/S1/S2/N1/N2, and assert a failure report on the writer routes, so silent skip/abort is caught everywhere; (2) add a backslash `..` sink case (pack target, writer path, rename, parsable, loose, multi-volume); (3) add variable/derived `..` cases for the uninstaller path/name and log; (4) add a terminal `..` and a multi-segment `../../..` case; (5) re-scope `manifest.verified.sites`, `task.toml.entry_point`/`difficulty_explanation`/`solution_explanation` (they still list the ungraded configuration family) or add graded config tests; (6) regenerate the `sf-miss-*` probes from the current oracle (they still abort and fail P3 as well as their own trap; `sf-miss-B1` fails 2), and correct the manifest's "fails exactly its own trap" wording; (7) update the stale final gate block in `notes.md` (20/36, 56/56) to the authoritative 14/36, 50/50; (8) reframe S2 as a volume-progress override.

**Human review:** confirm that (i) the general property requires the check at the create/write site, so a guard only where installer metadata is loaded/populated is out of scope by design (the `WriterFixture` does not run the loader), (ii) `getResult() == false` is the intended "installation failure" surface for the P2 test, and (iii) the writer's existing `write()` catch/boolean path is the expected refusal form (a throw from an uncaught place would error the test).

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
