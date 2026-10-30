# cryptography-s4 — build notes

- Start (UTC): 2026-10-30T00:15:02Z
- End (UTC): 2026-10-30T00:40:30Z

## Candidate correction (verified, not a guess)

The screener record pins `194c9477…` and lists `286c8912…` + `4d035a42…` as the
fix. `194c9477` is the parent of `286c8912`, a 2025 compatibility change that
first lets wildcard SANs reach DNS constraint evaluation. At `194c9477` a
wildcard SAN under a DNS name constraint fails closed (`DNSName::new` rejects
`*`), so the advisory's acceptance escape does not reproduce.

- GitHub Advisory API (`/advisories/GHSA-m2h6-j472-rp4c`) and NVD
  (`CVE-2026-69248`): affected 45.0.0–48.0.0, fixed in 49.0.0; the core issue is
  `DNSConstraint::matches`, where a wildcard matched a more-specific permitted
  subtree.
- The published security fix is `4d035a4225…`; its parent `b3f077f7…` contains
  exactly that code (`DNSConstraint::matches(&DNSPattern)` with the wildcard
  overlap branch). `fix_commits` are not a contiguous series: `4d035a42` needs
  `DNSConstraint::matches(&DNSPattern)`, which does not exist at `194c9477`.
- Decision: pin `b3f077f7bef906383be2bd92c49de10a68ec9659` (fix parent) and use
  `4d035a4225965edeffd312079a510ef25fcfdcb2` as the published fix. Recorded in
  `manifest.candidate`.

## Levers (one line each)

- T1 (report, how-type): a wildcard SAN is a set; a permitted subtree must
  contain the whole set. Real upstream bug at lib.rs:156-180 / types.rs:168-212.
  Reason to dismiss: it is the reported route.
- T2 (injected, route where the check never runs): `build_chain_inner` skips
  name-constraint evaluation for self-issued CAs (lib.rs:366-374). Reason to
  dismiss: it looks like the RFC's self-issued exemption.
- T3 (injected, second implementation): requested-name matching treats a
  wildcard as a suffix match instead of exactly one label
  (policy/mod.rs:184-222). Reason to dismiss: different feature/module from CA
  constraints.
- T4 (coupled, over-broad): the excluded direction is overlap-based; applying
  the permitted containment rule to both directions silently stops excluding
  wildcard SANs (types.rs:205-212). Reason to dismiss: symmetric refactor looks
  cleaner.

## Property

One property, stated once over the wildcard's expansion set: a certificate is
never accepted for a requested name outside the set; a permitted scope admits a
wildcard only when the whole set is inside, and an excluded scope rejects it
whenever any of the set is inside. It covers T1, T2 and T3 literally; T4 is the
preservation side of the same property.

## What was verified

- Gate stages: static PASSED; nop PASSED (security 0/6 — all six fail as
  exploits — functional 8/8); oracle PASSED (3 runs, reward 1.0 each, identical
  results); patches PASSED (7/7 as declared: 3 security_fail, 2 functional_fail,
  `pass-hardening` 1.0, `pass-alternative` 1.0; the blind pass patch is produced
  downstream).
- Pinned+injected (nop): security 0/6 (all six fail as exploits), functional
  8/8 pass.
- Pre-warm staleness (found on the first gate nop run): the verifier image's
  `/opt/target` was built from a throw-away pristine checkout, and cargo's
  mtime-based freshness reused the pre-warmed lib artifact for the restored
  `/workspace`, so two injected defects were compiled out. Fixed by removing
  the project's own crates from the warm target (`cargo clean -p …` in
  `tests/Dockerfile`) and by doing the same at the start of `test.sh`'s BUILD.
  Re-verified inside the built verifier image: 0/6 security, 8/8 functional.
- Reference fix: security 6/6, functional 8/8, three local runs identical.
- Every `checks/` patch behaves as declared:
  - `sf-permitted-containment.patch`: 4 security fail, functional 8/8.
  - `sf-selfissued-guard.patch`: 2 security fail, functional 8/8.
  - `sf-hostname-matcher.patch`: 1 security fail, functional 8/8.
  - `ff-excluded-containment.patch`: security 6/6, functional 7/8.
  - `ff-refuse-all.patch`: security 6/6, functional 4/8.
  - `pass-hardening.patch`, `pass-alternative.patch`: 6/6 + 8/8.
- The crate's own unit tests at pinned+injected: 37 passed.
- Fixtures are DER certificates generated offline with `cryptography` 41.0.7;
  signatures are not exercised (the test `CryptoOps` returns `Ok`), so the tests
  depend only on path building and name matching.

## Not verified / open

- I did not run target-model trials (instructed not to).
- Upstream `present_in_latest` was not checked (no latest tree needed: no
  Pattern B rows).
- The CVE/NVD wording was read through the GitHub Advisory API and NVD REST API;
  the advisory HTML page itself is client-rendered and could not be read.
- Fairness concern: the reported escape is the one route a model is most likely
  to fix. Difficulty rests on T2/T3 (injected) and T4 (over-broad). If a model
  audits every wildcard consumer and every constraint call site it will find
  them; the instruction does not point at any of them.

## Pattern B register

No register rows: there are no real, unmodified-upstream uncovered routes for
this advisory at the pinned commit. The two additional routes (T2, T3) are
injected siblings, not Pattern B.

## Fairness / audit revision (2026-10-30)

Applied the three behaviour-only instruction edits from `AUDIT-FINDINGS.md`
(the owner's REPAIR decision after the trials):

- Observed impact now also states that a root permitting only one host name
  still accepts a certificate for a different host under the same domain.
- The property now states that a CA's name restrictions bind every certificate
  issued beneath it, including when the CA's own certificate is self-issued,
  and that being self-issued only exempts a certificate's own names from
  restrictions imposed by CAs above it.
- The exact-name preservation contract is narrowed to names that every CA in
  the path permits and does not exclude.

`manifest.leak_terms` dropped `permits` and `self-issued` because the required
behaviour wording now uses those ordinary terms; neither names a file, path,
module, symbol or test.

Deliberately not applied:

- FAIRNESS §3a asked to delete the contract bullet "A wildcard still matches
  exactly one label when names are compared." `AUDIT-FINDINGS.md`'s HARD RULE
  forbids deleting it (a prior attempt did, dropping a stated must-keep-working
  behaviour), and the owner rule forbids shortening the must-keep-working list.
  The repo precedent (`winter-s4`) is the same: the audit/blind finding wins
  over the review's generalize note when it would shorten that list.
- The non-blocking "Quality to tighten" list (extra fixtures, `--lib` unit
  tests in the verifier) was not applied because `AUDIT-FINDINGS.md` says
  "Do not edit tests."

Tests, `solution/fix.patch`, `checks/*.patch` and `manifest.patch_checks` are
unchanged; the oracle already covered all 14 tests.

