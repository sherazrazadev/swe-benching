# mpxj-s4 build notes

Start (UTC): 2026-10-30T17:38:00Z
End (UTC): 2026-10-30T18:12:01Z

## Design (one line per lever)

- **Property (stated once):** no file name or path contained in any archive the library expands —
  wherever inside an entry it is stored, and whichever supported archive container carries it —
  may cause a file or directory to be created, overwritten or written outside the temporary
  directory created for that archive; a name that would escape is refused with no side effect.
- **T1 — Pattern A, reported site, where-type:** the 13-byte NUL-terminated name in a P3 PRX
  entry header is joined onto the extraction directory and used by both the empty-file branch and
  the decompress branch (`P3PRXFileReader.extractFile`). Reason to dismiss: none — the report's
  trigger points here.
- **T2 — Pattern A, far site, where-type:** the SureTrak STX reader in a different package repeats
  the same extraction with a 260-byte name field (`SureTrakSTXFileReader.extractFile`). Reason to
  dismiss: a separate, older, less-used format; the report's reproducer is a P3 PRX archive.
- **T3 — Pattern A, injected far site, how-type (main):** a tar container reached from the same
  universal reader assembles an entry path from the ustar name field, the ustar prefix field, a
  PAX `path` record or a GNU long-name record, and creates file and directory entries
  (`TarHelper.expand`, wired from `UniversalProjectReader`). Reason to dismiss: a different
  container the report never mentions, while the pre-existing zip expansion already validates its
  entries; a check on the obvious name field misses the prefix, PAX and long-name sources.
- **Coupled must-keep-working:** archive names stay significant — legitimate flat names and nested
  paths are extracted to exactly the same relative positions, directory entries are created, and an
  archive that contains a readable schedule is still read. Over-broad fixes (reject any separator,
  collapse to a basename) break these.

## What I verified

- The flaw reproduces at the pinned commit through `UniversalProjectReader.read(InputStream)` for
  PRX and STX (self-extracting shapes), and through the injected tar route, in both the empty-file
  and decompress branches; each of the 9 security tests fails on the vulnerable tree and passes on
  the oracle.
- All 8 functional tests pass on both the vulnerable tree and the oracle.
- Every `checks/` patch was applied to a clean copy of the injected tree, compiled, and run
  against the hidden suites locally: `miss_base`, `miss_stx`, `miss_tar` and `check_on_basename`
  leave security tests failing with every functional test passing; `func_overbroad`,
  `refuse_all` and `crash` break functional tests; `hardening` and `alt_fix` score 1.0.
- The project's own deterministic, data-free tests (`XsdDurationTest`, `SemVerTest`,
  `DateUtilityTest`, `LocalDateTimeHelperTest`, `RateHelperTest`, `TimescaleUtilityTest`) pass at
  the pinned commit and on the oracle.
- The fix commit adds no test files, so the pinned copy contains no advisory regression tests.

## Gate results (run one stage at a time)

- `--only static`: PASSED.
- `--only nop`: PASSED - 9 security tests (all fail on the pinned+injected code) and 32 functional tests (all pass).
- `--only oracle`: PASSED - 3 runs, reward 1.0, 41/41 tests, identical results.
- `--only patches`: PASSED - `miss_base`, `miss_stx`, `miss_tar`, `check_on_basename` leave security tests failing with every functional test passing; `func_overbroad`, `refuse_all`, `crash` break functional tests; `hardening` and `alt_fix` score 1.0. The blind patch is deferred to postbuild as instructed.

## What I could not verify

- Target-model behaviour: no trials were run (the build instructions forbid running them).
- The advisory's published reproducer (a real PRX sample) was not available; the entry format was
  read from the pinned source and the streams are synthesised from those field layouts.
- `repo_mb` / presence of the routes in current upstream were not measured.

## Notes

- The repository is placed at `/workspace` (the schema-1.4 template and conformance checker require
  it); the build prompt's `/app` wording is stale.
- Out of scope, not built on: `opc/OpcReader.java` and `primavera/webservices/WebServicesReader.java`
  write to caller-supplied file names, not archive-derived names.
