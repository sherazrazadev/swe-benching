# snipe-it-s2 — build notes

- Start (UTC): 2026-10-27T22:24:36Z (build/snipe-it-s2/start_utc.txt)
- End (UTC): 2026-10-27T23:08:57Z

## Security property (written once, before choosing routes)

P1: no operation may change another account's authentication settings (whether the account can
sign in; whether its password is managed outside the product) unless the caller holds authority
over authentication settings for that specific target account, decided per target from the
account being changed. Values that disable/clear a setting must still apply where allowed, and
ordinary profile edits/group sync that travel with an auth change must keep applying to
protected targets.

P2 (genuinely different protection): an account must not be destroyed (deleted or folded into
another account) unless the caller holds both delete authority and authority over
authentication settings on the account being removed, decided per target.

The report (`instruction.md`) states these as invariants without naming any route beyond the
single reported trigger. Every tested route and sibling falls under P1 or P2 as written.

## Levers (one line each)

- L1 (reported, how-type: coupled must-keep-working + value shape): bulk mass update carries
  `activated`/`ldap_import` for all ids; `BulkUsersController.php:174-175,238-246`. Dismissal:
  the obvious site; the tempting fix pulls the fields or filters whole targets out, silently
  stopping city/display-name edits and group sync on protected accounts, and a truthiness check
  drops the `'0'` value that legitimately disables a setting.
- L2 (Pattern B, how-type: ordering): single-user save assigns `activated` before its own
  authority block; `UsersController.php:295`. Dismissal: the edit form disables the field, and
  the method visibly contains the authority block.
- L3 (Pattern B, how-type: protection never existed there): REST update excludes/gates the other
  sensitive fields but not `ldap_import`; `Api/UsersController.php:542`. Dismissal: neighbouring
  fields are handled, so the flag reads as an ordinary profile field; different transport.
- L4 (Pattern A, far site the published fix protects): account consolidation checks only the
  edit permission and soft-deletes the source; `BulkUsersController.php:401,420-424`. Dismissal:
  generic edit authorisation looks sufficient; the report is about auth flags, not removal.
- S1 (injected, how-type: protection never existed): bulk activate/deactivate quick action
  applies both flags to every id under the route permission only;
  `BulkUsersController.php:94-110` (injected). Dismissal: it mirrors the neighbouring
  bulk-password-reset action, which also acts immediately.
- S2 (injected, how-type: wrong object): toggle route asks the auth-field gate about the caller
  instead of the target; `UsersController.php:354-371` (injected). Dismissal: the gate call is
  visibly present; the argument is the subtle part.

At least two levers have different dismissal reasons and several are how-type (L1 shape/coupled,
L2 ordering, L3 protection-never-existed, S1/S2 route-never-protected / wrong object).

## Full candidate list and why the picks won

Searched every write of `activated`/`ldap_import` and every `canEditAuthFields` call in `app/`.

1. `BulkUsersController::update` (reported) — picked L1 (mandatory landing point).
2. `BulkUsersController::merge` — picked L4: the only other entry point the published fix
   protects (Pattern A), a genuinely different protection, real upstream code.
3. `UsersController::update` early assignment — picked L2: real, reachable, how-type ordering.
4. `Api/UsersController::update` fill list — picked L3: real, reachable, how-type route where
   the protection never existed. Checked current upstream master: still absent from the gated
   field constant.
5. `UserImporter` hand-rolled guard — rejected after a behavioural probe: the guard unsets the
   model's attributes, so the model's own `password`/`username` validation fails and the update
   never persists. It fails closed by accident, so it is not exploitably vulnerable at the
   pinned commit (recorded in `verified.uncovered_route_probes`).
6. `Api/UsersController::store` and `UsersController::store` — creation, not a change to an
   existing target; outside P1.
7. `UsersController::postCreate` (clone) — creates a new account; outside P1.
8. `Console/Commands/LdapSync` and `Models/Ldap` — CLI/sync machinery, no offline HTTP entry
   point; outside the advisory's HTTP surface.
9. `Api/UsersController::syncLdapUsers` — only wraps the LDAP CLI command and needs a live
   directory; not reproducible offline.
10. `BulkAssetModelsController` / `BulkAssetsController` bulk idiom — handles asset columns, not
    user authentication settings, so P1 would not cover it.
11. SCIM routes — behind `authorize:superadmin`; the authority under test is moot.
12. `ProfileController` — self-service; the caller is the target, allowed by definition.
13. `UserObserver` — logs changes only; no guard. Used later as the hardening pass.
14. S1 and S2 (injected) — chosen as the most plausible same-class gaps a maintainer could leave
    in the existing user-update surface: S1 copies the real `bulkpasswordreset` action shape; S2
    copies the self-profile gate call into a target-facing route. Both are covered by P1, have
    different dismissal reasons, and are placed where the published fix never touches.
15. Rejected an injected "legacy bulk update" controller: it would be a third bulk-update
    concept and a more obviously planted copy, adding search cost without a new dismissal
    reason.

## What was verified (on the pinned copy and in the built image)

- Flaw reproduces at the pinned commit through real entry points (each confirmed by a probe
  before building tests):
  - bulk edit: edit-only actor sets an admin's `activated` 1->0 and `ldap_import` 0->1, and the
    non-auth `city` also changes (so the legit value is real today).
  - single-user PUT: edit-only actor sets an admin's `activated` 1->0.
  - REST PATCH: edit-only actor sets an admin's `ldap_import` 0->1.
  - merge: edit-only actor soft-deletes an admin and a superuser.
  - injected S1/S2: attack values change the protected target; the same values still apply to an
    ordinary target (legit control).
- Oracle (`solution/fix.patch`) = published source changes (bulk per-target application + merge
  delete/per-target) plus the single-update, REST, S1 and S2 fixes. 28/28 hidden tests pass in
  the built image; 15/15 security tests fail and 13/13 functional tests pass on the pinned copy.
- In the built image the project's own `BulkDeleteUsersTest`, UI `UpdateUserTest` and API
  `UpdateUserTest` pass at the pinned commit (54 tests, 289 assertions). `MergeUsersTest` also
  passes at the pinned commit.
- Every checks/ patch was applied and measured on the host: l1/l2/l3/l4/s1/s2 leave only their
  own security tests failing (functional all pass); overbroad/refuseall/adjacent break functional
  only; crash/wrongobj/onerole break security only; hardening and alt score 1.0 on the hidden
  suite.

## What could not be verified / known tensions

- `MergeUsersTest` encodes the pre-fix merge permission (edit-only actors may merge) and fails
  under the reference fix, exactly as it does under the upstream fix commit (which did not update
  it). The graded functional suite therefore runs pristine copies of the other three affected
  project tests, not MergeUsersTest. A solver who runs the visible suite will see those seven
  failures after fixing merge; the report's second invariant says removal requires delete
  authority, so the old test is the stale one. This is the main fairness risk I see, and it is
  inherited from the upstream commit.
- `present_in_latest` was checked read-only against current upstream master: the single-update
  bug is fixed there (`present_in_latest=no`); the REST `ldap_import` fill is still missing from
  the gated-field constant (`yes`).
- No target-model trials were run (the build prompt forbids running them); the bar is claimed
  only from the gate.
- `repo_mb`, exact upstream issue coverage for the two uncovered routes, and whether the models
  will connect P2's "destroyed" wording to consolidation are unverified.

## Out of scope (one line)

CLI/LDAP sync and user creation paths write the same flags outside this advisory's HTTP surface
and were not built on.

## Gate (run in order, one stage at a time)

- static: PASS (conformance, no instruction leaks, 15 security tests with no exact-status
  assertions, hardening+alt present; blind patch intentionally absent).
- nop: PASS — 15/15 security tests fail on the pinned+injection copy, 60/60 functional tests pass
  (13 hidden + 47 project).
- oracle: PASS — 3/3 identical runs, reward 1.0, 15/15 security and 60/60 functional.
- patches: PASS — 14/14 declared checks: l1/l2/l3/l4/s1/s2 `security_fail` each leave only that
  lever's security tests failing with all functional passing; overbroad/refuseall/adjacent
  `functional_fail`; crash/wrongobj/onerole `security_fail`; hardening and alt `pass` at 1.0.
- The blind patch (kind `blind`) is deliberately absent; it is written downstream, together with
  FAIRNESS.md, per the build brief.
