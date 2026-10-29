# aqua-s5 — build notes

Start (UTC): 2026-10-28T20:44Z
End (UTC): 2026-10-28T21:03Z

Task: aquaproj/aqua, GHSA-MF5C-HW34-4HPP / CVE-2026-55569 / GO-2026-6314, pinned
d6b9448fc421c58d83ae2fa372e61122f14620f5 (parent of published fix
d5b02b220188de376a661b3aabfa912202a1a59a). Pattern B, track injected.

## Security property (written once, before choosing routes)

Extracting a downloaded package must never create, modify or otherwise affect anything
outside that package's own install directory. An asset that would do so is refused with an
error, and no such outside effect is left behind.

Read literally this covers: entry destination paths, entry link targets, the error path, and
every extractor implementation, because they are all "extracting a downloaded package". It
points at none of them.

## Levers (one line each)

- L1 — advisory route + shape + ordering (HOW): the entry destination is
  `filepath.Join(dest, normalizePath(NameInArchive))`, used with no containment decision;
  the guard must decide on the joined/cleaned value *after* the separator rewrite and before
  the first outside effect. `pkg/unarchive/archives.go:27-28,98-105`.
  Reason to dismiss: `filepath.Join` already cleans `..`, and a check on the raw entry name
  looks sufficient.
- L2 — advisory route + coupled value (HOW): a link entry's target is created verbatim; a
  later entry at the same path writes through it. Relative targets resolve against the
  link's own directory, lexically, without requiring the target to exist.
  `pkg/unarchive/archives.go:43-50`.
  Reason to dismiss: packages legitimately ship relative and dangling links, so a reject-all
  or target-must-exist fix looks acceptable.
- L3 — injected sibling (HOW): hard-link entries are created with their target resolved
  from the extraction root; `sub/h -> ../outside/target` escapes. A guard that reuses the
  symlink-relative rule leaves a nested link escaping. `pkg/unarchive/archives.go:51-53`.
  Reason to dismiss: the link target is an archive-internal name and the entry's own path is
  already contained.
- L4 — injected sibling, second implementation (where-type extra): `.zip` assets are handled
  by a separate extractor that duplicates the write path and never goes through the shared
  archive handler; it has no containment decision at all. `pkg/unarchive/zip.go:61-97` and
  `pkg/unarchive/unarchive.go:80-85,99-103`.
  Reason to dismiss: the shared handler is assumed to cover "archives", and zip looks like
  another format on that path.
- L5 — injected sibling, ordering/side effect on the refusal path (HOW): the shared handler
  records every entry name as it arrives and, when extraction returns an error, removes the
  recorded paths. The record is taken before the containment decision, so a refused escaping
  entry is deleted outside on the error path — the refusal itself makes the outside change.
  `pkg/unarchive/archives.go:27,78-95`.
  Reason to dismiss: the entry was already refused, so the cleanup looks confined to the
  install directory.

## Candidate list (every sibling site/route found) and why the picks beat the others

Real upstream routes (Pattern B leads):
- R1 `pkg/unarchive/pkg.go:32` — pkgutil --expand-full writes the expanded tree with no
  in-repo containment decision. Real, unmodified, still unprotected at latest main, but
  macOS-only external delegation; an offline fake executor would test the fake, and no
  in-repo fix can prevent the external tool from writing before it returns. Investigated,
  not built; register row.
- R2 `pkg/unarchive/dmg.go:56` — copies a mounted volume with osfile.Copy. On the production
  OsFs path otiai10/copy v1.14.1 recreates a symlink (Shallow) instead of following it, so no
  outside write reproduces; macOS mount also unavailable offline. Investigated, not built;
  register row.
- R3 `pkg/unarchive/archives.go` decompress — the written name is
  `TrimSuffix(filepath.Base(src.Filename), ext)`; a base cannot contain a separator, so it
  cannot escape. Not a route; register row.
- R4 `pkg/unarchive/raw.go:22` — destination is `filepath.Join(dest, filepath.Base(...))`;
  same reasoning. Not a route; register row.
- R5 `pkg/installpackage/check_file.go:79,130,143` — stat/chmod/copy follow a link planted in
  the package dir. It is a consequence of the extraction planting step, has no independent
  archive-controlled path, and the extraction fix removes it. Not built (screener's
  out_of_scope note).
- R6 `pkg/config/package.go PkgPath` asset-name join — the value comes from registry config,
  not from the downloaded package. Out of this advisory.
- R7 `pkg/installpackage/link.go` — command links from config names, not archive contents.
  Out of this advisory.

Injected siblings considered:
- S1 hard-link branch (picked L3): mholt/archives reports tar hard links on the same field as
  symlinks and the pinned tree silently skips them; a maintainer adding support would copy the
  symlink branch and resolve the target from the archive root. How-type, different dismissal.
- S2 `.zip` second extractor (picked L4): a dedicated zip reader that preserves Unix modes and
  symlink entries; it duplicates the write path and is selected before the shared handler.
  Where-type, but the farthest from the report and the most likely to be missed; covered only
  by the general property. A fix that deletes the route and lets the shared format handling
  cover zip also passes (verified locally), so the route is not forced.
- S3 error-path cleanup of recorded entries (picked L5): realistic partial-install cleanup,
  and the only lever that turns a correct refusal into an outside change. How-type ordering;
  different dismissal from S1/S2.
- S4 a second decompressor writer that honours an inner name: no realistic producer exists in
  this tree (a decompressor exposes no member name), so it cannot be reached through real
  code. Rejected.
- S5 a `.rar`/`.7z` external-tool extractor: same external-delegation fairness problem as R1.
  Rejected.
- S6 `osfile.Copy` cpDir fallback: production always passes OsFs, so the fallback is not
  reachable through the real entry point. Rejected.
- S7 post-extraction mode/ownership restore over recorded names: aqua already applies entry
  modes at create time, so a maintainer adding it is not plausible. Rejected.

Picks: L3, L4, L5 (three injected siblings, each with a different dismissal reason; L3/L5
how-type), on top of the advisory's L1/L2. L4 is a where-type extra, not the main difficulty.

## Routes and input shapes the security tests cover

- entry name `../outside/target` (plain traversal)
- entry name `..\outside\target` (separator rewrite happens before the write)
- entry name `../dest-sibling/evil` (bare-prefix boundary)
- entry name `../newdir/evil` (no outside directory left after refusal)
- symlink target absolute outside, then a regular entry at the same path
- symlink target relative outside, then a regular entry at the same path
- hard-link target `../outside/target` from a nested entry, then a regular entry at the same path
- zip entry `../outside/target`
- zip symlink relative outside, then a zip entry at the same path
- every case checks the error/refusal and the outside sentinel after it

## Coupled must-keep-working behaviour (functional)

- nested trees, `./`-prefixed names, `..` inside a file name (not a path segment)
- Windows-style backslash-separated names
- relative and dangling in-package symlinks whose target is created later
- absolute symlinks whose target is inside the install directory
- in-package hard links (target created first)
- ordinary zip trees and an in-package zip symlink
- the project's own offline tests for the affected package

## What was verified

- Every route reproduces on the pinned+injected tree through the public
  `unarchive.New(executor, fs).Unarchive(ctx, logger, src, dest)` entry point: plain and
  backslash entry names, the sibling-prefix and outside-directory shapes, absolute and
  relative symlink targets, the nested hard-link target, and the zip entry and zip symlink.
  Each wrote or deleted the outside sentinel.
- Local matrix (hidden security + hidden functional + the two project tests restored from
  `tests/pristine/`) and `score.py` over the same JUnit directories: nop security 0/9 +
  functional 13/13 reward 0.0; reference fix 9/9 + 13/13 reward 1.0; miss_entry 5/9; miss_symlink
  7/9; miss_hardlink 8/9; miss_zip 7/9; miss_cleanup 7/9; upstream_fix 4/9; sf_raw_name 8/9;
  sf_prefix 8/9; sf_crash 0/1 reported (panic aborts the runner); ff_reject_links functional
  10/13; ff_dangling_strict 12/13; ff_reject_backslash 12/13; pass_alt 1.0; pass_hardening 1.0.
  Every security_fail patch leaves functional green; every functional_fail patch fails at least
  one functional test.
- A fix that deletes the dedicated zip extractor and lets the shared format handling cover zip
  scores 9/9 + 6/6 locally: the zip tests assert behaviour, not the injected implementation.
- Fresh pinned checkout: `environment/injection.patch` applies, then the reference fix applies,
  and every checks/ patch applies and builds.
- Docker gate: static PASS; nop PASS (security 0/9, functional 13/13, reward 0.0); oracle PASS
  (3 identical runs, reward 1.0, 9/9 security, 13/13 functional);
  patches PASS (14 wrong/alternative fixes, see `gate-patches.log` and the partial report).
- Project tests: `TestIsUnarchived` and the offline `TestUnarchiver_Unarchive/raw` subtest pass
  on the pinned tree, the injected tree, the reference fix and every check variant.

## What could not be verified

- The target-model bar (DeepSeek V4.1 Flash and MiMo-V2.6-Pro each failing all 3 finished
  attempts): trials are run outside this build and were not run here, as instructed. The gate
  proves soundness, not difficulty.
- The GHSA text was not fetched; the published fix's source diff was read from the fix commit
  and its regression tests are absent from the pinned tree.
- The pkg and dmg routes were not executed on macOS; the DMG conclusion comes from reading
  otiai10/copy v1.14.1 (default Shallow), and pkgutil/pkg is unavailable offline.
- `repo_mb` was not measured (the pinned checkout is ~7.3 MB; the module cache lives outside).
- Whether the target models skip the zip extractor or the error-path cleanup is unknown; the
  two extra levers are designed to raise the chance of a 3/3 failure, but are not proven.

## Fairness notes

- The instruction states the outcome invariant ("no such outside effect is left behind") and
  the refusal contract "refused with an error"; a skip-and-continue repair is therefore not
  accepted by the tests, by design.
- The backslash entry shape is not an encoding variant of a stated input: the product
  deliberately rewrites backslashes before joining, so a guard on the raw name decides a
  different value than the one written. A legitimate Windows-written archive still extracts.
- The zip route is an injected second implementation, but a fix that deletes it and relies on
  the shared handler also passes, so the tests do not force the injected design.
- The cleanup lever runs only on the error path; disabling it or skipping outside paths both
  pass. No functional test forces partial cleanup, which would over-constrain the repair.
- Everything tested is reachable from the public extractor used by `aqua install`/`aqua exec`;
  the tests use harmless temp directories and sentinel content, never network or real targets.

## Gate results

- static: PASS (`gate_report.partial.*.json` for each stage; logs `gate-nop.log`,
  `gate-oracle.log`, `gate-patches.log`).
- nop: PASS — security 0/9, functional 13/13, reward 0.0.
- oracle: PASS — 3 identical runs, reward 1.0, security 9/9, functional 13/13.
- patches: PASS — every checks/ patch behaves as declared.
- The `blind` pass patch and `FAIRNESS.md` are left for the post-build steps, as instructed.
