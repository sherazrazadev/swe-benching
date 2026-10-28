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
