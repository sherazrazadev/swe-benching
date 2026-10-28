# nono-s2 — build notes (build-v1, pattern A+B, injected track)

- start: 2026-10-27T22:24:45Z (build/nono-s2/start_utc.txt)
- end: 2026-10-27T23:2xZ (see the last line of this file)
- repo: nolabs-ai/nono @ 61a589f4b2e4022637ef3460e527ad774ed95635 (vulnerable)
- published fix: db07375031642f089d549b4f7b9abece87e39f87 (merge commit; source changes in
  `crates/nono-cli/src/{profile_runtime,wiring,package_cmd}.rs`)

## Plan (written before the task package)

### Product property (one property, stated once in the report)

A pack's content may influence what the tool grants, denies, reports or writes only after the
tool has established that the pack is the one recorded at install time: an install record for
the pack exists, it names the signer, the stored signature material is present, every digest the
record holds matches the file on disk, and every file the tool takes from the pack is covered by
one of those recorded digests. Otherwise the operation is refused with no effect.

The property is written over the protected outcome ("content of the pack the tool actually takes
content from") and never names a site: read literally it covers the run path, the policy merge,
both read-only surfaces and the alternate on-disk location.

### Levers

- **T1 (reported; A, where-type anchor).** The run-time pack check returns success when the
  install record is absent, when the stored signature material is absent, and when the record
  covers no file: `crates/nono-cli/src/profile_runtime.rs:67-163` at the pinned commit
  (`if let Some(locked_pkg) = locked { ... }`, `if bundle_path.exists() { ... }`). Reason to
  dismiss: none — this is the landing point. Shapes: no record; record without stored
  signature material; record whose artifact map does not cover the profile file.
- **T2 (Pattern B, how-type; wrong-object + merged route).** Policy material from every pack in
  the install record is merged into the global policy while a profile is being finalized, before
  and independently of the reported check, and the result is cached process-wide:
  `crates/nono-cli/src/policy.rs:1409-1446` (`load_package_groups`), reached from
  `profile::finalize_profile` → `merge_implicit_default_groups` (every profile load) and from
  `CapabilitySetExt::from_profile`. Reason to dismiss: the packs are already listed in the
  install record, so the record is treated as the trust anchor — exactly the assumption the
  advisory breaks. Our copy also carries an injected, plausible partial gate that checks the
  group file against the *stored signature material* only when it exists and lists the file
  (the injected sibling INJ-A), so the route looks protected. Shapes: no stored signature
  material; signature material without a group entry (wrong object: the bundle subject instead
  of the recorded digest); record whose artifact map is empty (coverage).
- **T3 (Pattern B, how-type; route where the protection never existed).** The read-only
  surfaces read pack content without ever calling the reported check:
  `crates/nono-cli/src/why_runtime.rs:116-151` (`why --profile …` builds capabilities straight
  from the pack profile) and `crates/nono-cli/src/profile/mod.rs:2123-2187` /
  `2006-2098` (`load_registry_profile` and `find_pack_store_profile`, used by
  `profile show/diff/validate` through `load_profile_no_migrate`). Reason to dismiss: they are
  read-only and never create a sandbox, so verification looks like a run-time concern.
  Shapes: registry reference with no record; bare name found by store scan with a record but no
  stored signature material; profile display of an unrecorded pack.
- **T4 (injected sibling INJ-B; how-type; wrong object — the pack actually used).** A
  compatibility fallback reads packs installed under `$HOME/.nono/packages`, while the reported
  check resolves the pack under the managed store only. When the managed copy is missing the
  check treats the pack as "not installed" and continues (`!install_dir.exists() → warn;
  continue`), so the pack loaded from the other location is never checked. Sites:
  `crates/nono-cli/src/package.rs` (legacy store helper, injected),
  `crates/nono-cli/src/profile/mod.rs:2123-2180, 2006-2123` (fallback in
  `load_registry_profile` and `find_pack_store_profile`). Reason to dismiss: the pack is not in
  the managed store, so there is nothing there to verify.

Coupled must-keep-working behaviour next to each lever: a fully recorded pack keeps working
(reported verified, grants apply, policy material binds, profile display works); a profile
naming a pack that is not installed at all keeps working as today; a profile with no pack
content keeps working; a fully recorded pack in the alternate location keeps working.

### Candidate sibling sites (full list found, and the pick)

Screener O8/O8b leads, each confirmed in the pinned tree:

1. `policy.rs load_package_groups` — pack group files merged for every install-record package
   with no check (O8 route 1, O8b injection room 1). **Picked (T2; real code + INJ-A).**
2. `why_runtime.rs run_why --profile` — capabilities straight from pack content, no check
   (O8 route 2). **Picked (T3).**
3. `profile/mod.rs load_registry_profile` / `find_pack_store_profile` — pack profile content read
   before verification; inspection commands stop there (O8 route 3). **Picked (T3).**
4. `package_cmd.rs copy_instruction_to_project` — `--init` copies pack content into the user's
   project with an existence-only check (O8b injection room 2). Rejected: `nono pull` needs a
   registry and a valid Sigstore bundle; no offline entry point reaches it (same reason the
   published fix's `wiring.rs`/`package_cmd.rs` force-recovery changes cannot be tested here).
5. `wiring.rs` WriteFile ownership guard and the other wiring directives (O8b injection room 3).
   Rejected: only `nono pull`/`nono remove --force` reach the interpreter; `pull` needs the
   registry and a real signature, so no behavioural test can drive it offline.
6. `profile/mod.rs find_pack_store_profile` scanning the store directory — a second discovery
   route, real upstream. Folded into T3 (same check needed).
7. `sandbox_prepare.rs:1285-1307` granting read of every declared pack directory — runs after
   the reported check, so a refusal already happens first. Rejected (no independent gap).
8. `profile_runtime.rs` session-hook `source_pack` membership check — hooks are run only on
   launch, and dry-run does not execute them; testing needs a live sandbox. Rejected (test
   environment risk).
9. `package.rs read_lockfile` returning an empty lockfile when absent — feeds T1; folded into
   T1's no-record shape rather than a separate lever.
10. `package_status.rs enforce_for_active_profile` (network status lookup before the reported
    check) — reads only the install record and the registry; no pack content is used. Rejected.
11. `pack_update_hint.rs` / `update_check.rs` — read pack metadata for a one-line hint only.
    Rejected (no capability effect).
12. `package.rs`/`migration.rs` auto-pull on a missing pack — network side effect, not content
    use. Rejected.
13. `profile/mod.rs load_profile_extends` preview parse — used by `profile show`/`profile
    diff`/pack-status to read `extends`; its output is display-only, except that it reads the
    same pack file. Covered by T3's loader fix; not a separate lever.
14. `trust_cmd.rs` TrustPolicy artifacts — validated at install only; no runtime consumer.
    Rejected.
15. Legacy store fallback (our own search; not in the screener list): a compatibility path that
    reads `$HOME/.nono/packages`, which the reported check never resolves.
    **Picked (T4 / INJ-B).**

Why T2/T3/T4 beat the others: T2 and T3 are real, unmodified upstream consumers of pack content
(the strongest kind), reachable offline through `nono run --dry-run`, `nono why` and `nono
profile show`, far from the landing point, and each has its own reason to look out of scope. T4
is the hardest of the injected candidates: it is how-type (the check and the loader resolve the
pack to different paths; a missing directory makes the check silently skip), reachable through
the same real entry points, has a plausible compatibility reason, and its absence reads as
design. It also adds a coupled functional requirement (a verified pack in the alternate location
must keep working) that punishes "disable the fallback".

### Test design

Security tests drive the built CLI only (standalone integration tests using
`CARGO_BIN_EXE_nono`): 10 cases over the four levers and the input shapes above. Functional
tests: 8 cases, including every coupled behaviour. The project's own unit tests for the affected
area run in the verifier as a separate functional group.

## Verification performed during the build (scratch worktrees at /home/runner/.tb-graders/cwe/work/nono-s2)

- Reproduced T1 on the pinned tree: a pack directory with no install record makes
  `nono run --dry-run --profile <local profile naming it>` print "Verified 1 pack(s)" and exit 0;
  the published fix's binary refuses. A record without stored signature material behaves the
  same (pinned accepts, published fix refuses). A complete record with `[]` signature material
  is accepted by both (the positive fixture).
- Reproduced T2 on the pinned tree and on the published-fix tree: a tampered group file whose
  digest is still recorded the original way is merged into the global policy and
  `nono why --profile usegrp --path <granted>` answers ALLOWED. After the published fix it still
  answers ALLOWED, confirming the route is untouched.
- Reproduced T3 on the published-fix tree: `nono why --profile acme/widget …` answers ALLOWED
  and `nono profile show acme/widget` displays the pack profile with no install record at all.
- Built the injected tree (INJ-A + INJ-B) and confirmed: the group route still answers ALLOWED
  in the three metadata-absent shapes and is refused only when the stored signature material
  itself lists the wrong digest (so the partial gate is real); the alternate-location pack loads
  through `run`, `why` and `profile show` while the reported check warns "not installed".
- Built the reference fix (published source changes + the consumer fixes) and confirmed all 10
  security cases are refused and all 8 functional cases pass; the crate's own 1130 unit tests
  pass (`cargo test -p nono-cli --bin nono`).
- Confirmed the injected baseline (the nop image) fails all 10 security tests and passes all 8
  functional tests.
- Confirmed the wrong-fix variants locally (results in build/nono-s2/checks; see the manifest).

## What could not be verified

- The published fix's `wiring.rs`/`package_cmd.rs` force-recovery changes are included in the
  reference patch but have no behavioural test: `nono pull` needs a registry and a real Sigstore
  bundle, neither of which can be produced offline against the embedded production trust root.
  This is the "wiring force adoption" part of the advisory; the task tests the pack trust
  decision everywhere else.
- A genuinely signature-verified pack cannot be constructed offline (the production Fulcio root
  is embedded and no test hook overrides it for pack verification). Positive fixtures
  therefore carry an empty stored bundle; the tests exercise the gate's fail-closed conditions
  (record, signer, stored bundle, recorded digests, coverage), not the Sigstore cryptography
  itself. The crypto path is unchanged from upstream and is out of this advisory's protection.
- `present_in_latest` for the uncovered routes: the current upstream tree was fetched only to
  confirm the pinned/fixed commits; no current-release comparison was made (recorded unknown).
- Whether the environment image builds cleanly on the gate host (verified locally only through
  the scratch cargo builds; the Docker gate stages decide this).

## Out of scope noticed

- The Sigstore cryptography in `crates/nono/src/trust/` was read only far enough to confirm what
  the stored-bundle verifier feeds it; not audited.


## Gate results (run in order, one stage at a time)

- static: FAIL only on `manifest.patch_checks has no expect=pass patch with kind='blind'` (expected;
  the blind patch is written after this build) and FAIRNESS.md (written after the trial). No other
  static or Frontier-conformance problem.
- nop: PASSED. The injected baseline scored 0/10 security, 8/8 hidden functional and 26/26
  project functional tests.
- oracle: PASSED. Three runs, reward 1.0 each, identical security and functional results.
- patches: PASSED. All 8 checks behave as declared; per-check failing sets are in the manifest status and gate_report.partial.json.
- Verifier note: nextest writes its JUnit relative to the workspace `target/` even when
  CARGO_TARGET_DIR points elsewhere; tests/test.sh therefore configures an absolute JUnit path
  (`/opt/target/nono-junit.xml`) and copies it per group. The first nop attempt failed only on
  that path (infra:no_results), with the same correct test outcomes.
- end (UTC): 2026-10-27T23:24:51Z
