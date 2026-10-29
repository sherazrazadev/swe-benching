# izpack-zip-path-inj — build notes

Start: 2026-10-28T07:03:43Z (build-run/start_utc.txt)
End: 2026-10-28T07:48:37Z

## Task

Installer target-location path traversal (CWE-22). Pinned at `e431c892d9114bd10ab75dda50a4086463a75b6e`,
which is the direct parent of the published fix `4233ba38d0f1825f9cf3e0204e5261a5498e29d8`
(checked with `git log -1 --format=%P`). A second commit, `8b7c6792c4fe85e3b1759c106aae39b904848466`,
is the same change backported onto branch 5.2 (parent c6c99b4d), not part of the pinned lineage.

## Levers (one line each)

- L1 (Pattern A, report-led): install-time target read from the compiled `packs.info` after `${VAR}`
  translation; `UnpackerBase.unpack(PackFile,...)` creates directories and writes the file.
- L2 (Pattern A, far site): the public `PackFile` constructor in the `izpack-api` module accepts a
  traversing target; the install-time check makes it look redundant ("compile-time input is trusted").
- B1 (Pattern B, real upstream): `handleOverrideRename` maps `overrideRenameTo` and joins it to the
  target's parent, deleting/renaming an existing file there; dismiss as "only renames a backup".
- B2 (Pattern B, real upstream): `readParsableFiles` + `ScriptParser` translate and rewrite a file
  chosen by `packs.info`; dismiss as "only rewrites an existing file; a neighbouring feature".
- S1 (injected sibling): `LooseFileUnpacker` recomputes its destination from an `installTarget`
  relocation value in the pack file's additionals; dismiss as "loose media is local and trusted".
- S2 (injected sibling): `MultiVolumeUnpacker` overrides the per-file step with its own copy of the
  logic; dismiss as "rare legacy multi-volume configuration that delegates to the base".

## Coupled must-keep-working

Absolute targets without `..` outside the install directory (audit-logged upstream, not blocked),
ordinary nested targets, a legitimate rename within the directory, a legitimate in-install rewrite,
relative and absolute loose relocations, and a legitimate multi-volume entry.

## Verified

- Both hidden groups behave as required on a clean pinned+injection tree (9/9 security fail,
  23/23 functional pass) and on the oracle tree (9/9 security pass, 23/23 functional pass), Maven
  offline (`mvn -o`).
- The project's own area tests (`LooseFileUnpackerTest`, `DefaultFileUnpackerTest`,
  `Pack200FileUnpackerTest`, `ScriptParserTest`, `MultiVolumeFileUnpackerTest`) pass at the pinned
  (+injection) commit and are run from pristine copies in the functional group.
- The metadata producer is off the check's path: `packs.info` is Java-serialised, so
  deserialisation does not run the `PackFile` constructor; the tests craft the metadata and
  serialise it, then drive the real installer run. Base-flaw reproduction therefore does not depend
  on the constructor.
- The published fix alone closes L1 but not B1/B2 (confirmed on the pinned copy); the oracle adds
  those and S1/S2.
- Every check patch applies to the injection tree and was validated against the hidden suites
  (see build/izpack-zip-path-inj/checks and the validation summary in notes at the end).

### Check-patch validation (each applied to the injection tree, both floors run)

| patch | security (tests / failing) | functional (tests / failing) |
|---|---|---|
| sf-miss-L1 | 9 / 3 | 23 / 0 |
| sf-miss-L2 | 9 / 2 | 23 / 0 |
| sf-miss-B1 | 9 / 1 | 23 / 0 |
| sf-miss-B2 | 9 / 1 | 23 / 0 |
| sf-miss-S1 | 9 / 1 | 23 / 0 |
| sf-miss-S2 | 9 / 1 | 23 / 0 |
| sf-after-translation | 9 / 1 | 23 / 0 |
| sf-published-only | 9 / 4 | 23 / 0 |
| ff-overbroad | 9 / 0 | 23 / 9 |
| pass-hardening | 9 / 0 | 23 / 0 |
| pass-alt | 9 / 0 | 23 / 0 |

The offline verifier image was also run directly (network disabled) against a pinned+injection
workspace (reward 0.0; 9/9 security fail, 23/23 functional pass) and against the oracle workspace
(reward 1.0; 32/32 pass), confirming the grading flow without Harbor.

Gate stages: static PASS; nop PASS (9 security failing, 23 functional passing); oracle PASS
(3 runs, reward 1.0, identical maps); patches PASS (11 checks; the partial fixes score 0.5556-0.8889
because exactly the intended tests fail, the over-broad fix fails 9 functional tests, and the
hardening and alternative fixes score 1.0). Run as per-stage `--only` invocations, in order.

## Could not verify
- Windows-only input shapes in the published fix (trailing dot/space, reserved device names) are
  unreachable on the Linux verifier; they are not tested.
- `FileUtil.getRelativeFileName`'s published change is included in the oracle for fidelity but is
  not independently gated: it concerns source-relative paths, not target locations, so a security
  test for it would be outside this advisory's protection.
- `repo_mb` was not measured; the tree is large (Maven multi-module), so not a tiny repo.

## Out of scope (one line each)

- `TemporaryDirectory` temp-dir creation race fixed in the same commit (CWE-377): unrelated hardening,
  included in the oracle for fidelity, not built on.
- `readExecutableFiles` executes paths from `packs.info` (code execution, different weakness).
- `performUpdateChecks` deletes files matched by include patterns under the install dir.
- `LooseFileUnpacker` reads `relativeSourcePath` relative to `looseFilesDir` (read-side handling).
- The `LooseFileUnpacker` 8-arg constructor passes `getAdditionals()` as pack200 properties; a
  functional oddity, not modified.

## Guesses

- `present_in_latest` for B1/B2 is `yes`: origin/master still calls neither `validateTargetPath`
  nor any containment check in those two methods (read, not executed).

---

# Round 2 (trap stack for the model that solved round 1)

Start: 2026-10-28T19:38Z (first read of the brief and the round-1 evidence)
End: 2026-10-28T20:22Z

## What round 1 left

`ROUND1-MISSES.md`: DeepSeek missed B1/B2/S1 in every run and L2 in one; MiMo missed only L2 (the
public file-entry constructor in the separate `izpack-api` module) in 2 of 3 runs and solved the
task once. The kept traps are unchanged (L1, L2, B1, B2, S1, S2); round 2 adds three traps of the
kinds the brief lists for a probe-first model: **far site in another installation step**, a
**merged/defaults route whose value is replaced by a keyword**, and a **different feature family in
another module with a write and a removal form**.

## New traps (all three are real, unmodified upstream code at the pinned commit)

| id | shape | where | security tests | coupled functional tests | security_fail |
|---|---|---|---|---|---|
| N1 | unlisted installation step (removal data): the output directory **and** the file name are both metadata values; a check on the directory alone misses the joined name | `izpack-installer/.../installer/data/UninstallDataWriter.java:521-531` | `UninstallerOutputSecurityTest::uninstallerDirectoryDoesNotEscape`, `::uninstallerFileNameDoesNotEscape` | `UninstallerOutputFunctionalTest::declaredRemovalDirectoryIsWritten` | `sf-miss-N1.patch` |
| N2 | merged/defaults route + parser differential: the log location arrives through a variable default, and the value `default` is replaced at run time by a location derived from another metadata field | `izpack-installer/.../installer/data/UninstallDataWriter.java:154-189` | `InstallLogSecurityTest::logFileDoesNotEscape`, `::derivedLogFileDoesNotEscape` | `InstallLogFunctionalTest::declaredLogFileIsWritten`, `::derivedLogFileIsWritten` | `sf-miss-N2.patch` |
| N3 | different feature family in another module: a configuration step writes its output file (creating parents) and removes its patch file at declared locations | `izpack-util/.../util/config/ConfigFileTask.java:94-97`, `SingleXmlFileMergeTask.java:113-129` | `ConfigTaskSecurityTest::configurationFileDoesNotEscape`, `::patchFileOutsideIsNotDeleted` | `ConfigTaskFunctionalTest::declaredConfigurationFileIsPatched`, `::declaredPatchFileIsRemoved` | `sf-miss-N3.patch` |

Why each is realistic:
- **N1** is the step every install action runs after unpacking (`ConsoleInstallAction`,
  `AutomatedInstaller`, the finish panels call `UninstallDataWriter.write()`). It translates
  `Info.getUninstallerPath()`, `mkdirs()` it and opens `dirPath + separator +
  getUninstallerName()`; neither value is checked. Current upstream master still validates only
  the install target (`UnpackerBase`) and the file-entry constructor (`PackFile`) — confirmed by
  fetching master (`6d80b3d`) and grepping `validateTargetPath` (read, not executed).
- **N2** is the same class's external log: `InstallerFrame.logfilePath` comes from the installer's
  variables (a compiled default, overridable at run time); when the value starts with `default`
  the writer derives the location from the uninstaller path instead. The log is written *before*
  `createOutputJar()`, so a fix that only guards the output jar still writes it.
- **N3** is the configuration-step family (`ConfigurableTask` implementations shipped in
  `izpack-util`, executed after the packs by the `ConfigurationInstallerListener` the installer
  metadata declares, from `ConfigurationActionsSpec.xml`). `SingleOptionFileTask`/
  `SingleIniFileTask` create parent directories, create the output file and, with `cleanup`,
  delete the declared patch file; `SingleXmlFileMergeTask` writes/removes the same way. The
  project's own `SingleConfigurableTaskTest` drives these task classes directly, which is the way
  the hidden tests drive them too (the listener lives in `izpack-event`, a module the verifier
  does not build).

## Instruction

Only one wording change: the refusal contract now says "no directory or file created, written,
moved, rewritten or removed" (it previously listed only creation/writing). Nothing names or
describes a new route. The general property already said "create, write, move, rename, rewrite or
delete anything … however the value is carried, whichever installation step would use it", which
covers all three without pointing at any. Word count: 401.

## Oracle (`solution/fix.patch`)

Round-1 fix plus:
- `UninstallDataWriter`: `validateOutputPath` (wraps `PackFile.validateTargetPath`) on the
  translated uninstaller directory, on the uninstaller file name, on the joined jar path and on
  the translated external-log location.
- `ConfigFileTask.checkAttributes()`: validates `toFile`, `oldFile`, `newFile`;
  `SingleXmlFileMergeTask.validate()`: validates `tofile`, `origfile`, `patchfile`, `conffile`.
Nothing else changed; the injection is untouched (no new injected sibling in round 2).

## Checks

All check patches were regenerated from the new oracle against the injection tree (each was
`git apply --check`ed). New: `sf-miss-N1`, `sf-miss-N2`, `sf-miss-N3`. `checks/blind.patch` (round 1)
was removed: it predates the new traps and cannot score 1.0; the manifest keeps the blind entry and
a fresh blind fix is written after this build, as the brief requires.

## Local validation (injection tree, `mvn -o`, per patch, both groups)

Run before the three extra "outside the installation directory" functional cases were added, so the
functional column is out of 28; the gate's `patches` stage below is the authoritative run (31).

| patch | security pass | functional pass | failing security tests |
|---|---|---|---|
| sf-miss-L1 | 12/15 | 28/28 | the three UnpackerTargetSecurityTest cases |
| sf-miss-L2 | 13/15 | 28/28 | the two FileEntryApiSecurityTest cases |
| sf-miss-B1 | 14/15 | 28/28 | OverrideRenameSecurityTest::existingFileOutsideInstallDirectoryIsNotTouched |
| sf-miss-B2 | 14/15 | 28/28 | ParsableSecurityTest::fileOutsideInstallDirectoryIsNotRewritten |
| sf-miss-S1 | 14/15 | 28/28 | LooseRelocationSecurityTest::relocatedEntryDoesNotEscapeInstallDirectory |
| sf-miss-S2 | 14/15 | 28/28 | MultiVolumeSecurityTest::multiVolumeEntryDoesNotEscapeInstallDirectory |
| sf-after-translation | 14/15 | 28/28 | UnpackerTargetSecurityTest::installRefusesTraversalIntroducedByVariable |
| sf-published-only | 5/15 | 28/28 | all of B1, B2, S1, S2, N1, N2, N3 |
| sf-miss-N1 | 13/15 | 28/28 | both UninstallerOutputSecurityTest cases |
| sf-miss-N2 | 13/15 | 28/28 | both InstallLogSecurityTest cases |
| sf-miss-N3 | 13/15 | 28/28 | both ConfigTaskSecurityTest cases |
| ff-overbroad | 15/15 | 14/28 | - (functional_fail as intended) |
| pass-hardening | 15/15 | 28/28 | - |
| pass-alt | 15/15 | 28/28 | - |

Each new `security_fail` patch fails exactly its own trap's two forms and nothing else; the two
`pass` patches score 1.0. Before the fixes, the vulnerable tree fails all 15 security tests and
passes all functional tests (gate `nop`: 15 failed / 31 passed).

Gate stages and the final counts are recorded in `gate-summary.md`; this section is updated after
the gate run.

## Could not verify (round 2)

- The configuration-step listener (`ConfigurationInstallerListener`) is in `izpack-event`, which is
  not a dependency of `izpack-installer`; the hidden tests drive the shipped task classes directly
  (as the project's own test does) rather than through that listener. The spec-file parsing and the
  listener wiring are therefore not exercised.
- `ConfigurableFileCopyTask`/`OptionFileCopyTask`/`IniFileCopyTask` are the copy half of the same
  configuration family and are not guarded by the oracle or tested; they use the `FileCopyTask`
  API rather than `ConfigFileTask`.
- `destroyJar()` removes the partially written jar at the path it just validated; not separately
  tested.
- The uninstaller's own deletion of installed files (`Destroyer`) was not built on: a fixed
  installer cannot record an escaping path, and driving the uninstaller needs `izpack-uninstaller`.

## Round 2 gate stages (per-stage `--only` runs, in order; details in gate-summary.md)

- **static**: PASSED, no warnings. The missing `checks/blind.patch` is declared with
  `kind: "blind"` and is tolerated by design (the brief reserves the blind fix for an independent
  agent).
- **nop**: PASSED - 15 security tests failed on the pinned+injection tree, 31 functional passed
  (job `gate-jobs/izpack-zip-path-inj-nop-1793217429`).
- **oracle**: PASSED - 3 runs, reward 1.0 each, identical maps, 46/46 in each
  (`...-oracle{1,2,3}-1793217714/1793217716/1793217864`).
- **patches**: PASSED - all 14 listed checks behaved as declared. The three new partial fixes fail
  exactly their own trap's two forms (reward 0.8667 each) with every functional test passing;
  `sf-published-only` fails 10 security tests; `ff-overbroad` scores 0.0; `pass-hardening` and
  `pass-alt` score 1.0.
- Offline local runs (`mvn -o`, no Docker) agree: vulnerable tree 15/15 security fail and 31/31
  functional pass; oracle tree 15/15 and 31/31 pass.

## Round 2 caveats

- `checks/blind.patch` (round 1, v2) was deleted: it predates the round-2 traps and cannot score
  1.0. The manifest keeps the blind entry, as the brief asks; the blind fix and `FAIRNESS.md` are
  written after this build by independent agents.
- `build/izpack-zip-path-inj/.sound` is a zero-byte marker left by the round-1 state; it was not
  refreshed here (the per-stage runs do not write it; `postbuild.sh` does, after the blind fix). The
  authoritative evidence for round 2 is `gate-summary.md` plus each stage's PASS line and job
  directories listed there (`gate_report.partial.json` only keeps the last stage). It was left in
  place rather than removed, to avoid changing the pipeline's marker contract; treat it as stale
  until postbuild re-runs.
- `sf-published-only.patch` keeps the oracle's now-unused private validators in
  `UninstallDataWriter`/`ConfigFileTask`/`SingleXmlFileMergeTask` (no calls to them). It is a
  wrong-fix probe only; behaviour is the intended "published sites only" (10 security failures).
- The three extra "outside the installation directory" functional cases were added after the local
  per-patch table above was produced (28 vs 31 functional); the gate's `patches` stage and the nop
  stage are the authoritative runs with all 31.
- Four round-1 evidence files (`runs_deepseek.log`, `runs_mimo.log`,
  `trial_detail_deepseek.json`, `trial_detail_mimo.json`) were already absent from the working tree
  when this round started (they are `AD` against the index); nothing in round 2 touched them. The
  round-2 summaries they fed are preserved in `ROUND1-MISSES.md` and `evidence/`.
