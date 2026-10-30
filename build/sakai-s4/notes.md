# sakai-s4 build notes

- Start (UTC): 2026-10-30T00:05Z
- End (UTC): 2026-10-30T01:09Z

## Task

Sakai profile object-level authorization (CWE-639), pattern A, injected track. Pinned commit
`2696b4b48cbef2e81512f52f84f7477adff78b27`, published fix `a092dbf3dc6bf343131f50007c207a9abd95e852`.
The verifier restores `/workspace`, rebuilds `profile2/api`, `profile2/util`, `profile2/impl` and
`webapi` offline against a pre-warmed Maven repository, and runs 14 hidden security tests plus 31
functional tests (including the project's own 7 profile service tests) with Maven surefire.

## Levers (one line each)

1. `t-patch-identity-rewrite` (A, HOW, shape): the identity that the profile save uses comes from the
   request body after a JSON Patch is applied, so a path-variable check is not enough
   (`webapi/.../ProfileController.java:117-140`, `profile2/impl/.../ProfileServiceImpl.java:873-910`).
   Dismissal: the path already names the caller and the patch looks like field edits.
2. `t-pronunciation-delete` (A, HOW, route where protection never existed): pronunciation removal had
   no session and no ownership check (`ProfileController.java:262-267`,
   `ProfileServiceImpl.java:912-920`). Dismissal: the report is about a picture and the recording is a
   neighbouring self-service feature the roster only reads.
3. `t-official-image` (B, HOW, real unmodified upstream code): the institution-supplied picture store
   can be written for any identifier (`ProfileServiceImpl.java:448-458`); the published fix never
   touches it. Dismissal: institution-supplied pictures look privileged and the only in-tree caller
   passes its own identifier. Still unchecked on upstream master (checked 2026-10-30).
4. `t-profile-lock` (A, injected sibling): a new web route persists a user's profile lock for any
   identifier (`ProfileController.java` setProfileLock; `ProfileServiceImpl.java` setProfileLocked,
   wrapping the real `toggleProfileLocked`). Dismissal: a lock is a visibility preference, and the
   route is self-service plumbing.
5. `t-social-links` (A, injected sibling): a dedicated route persists a user's social profile links
   directly, bypassing the combined profile save (`ProfileController.java` putSocialNetworking;
   `ProfileServiceImpl.java` saveSocialNetworkingLinks). Dismissal: the links are public and the
   combined save already writes them.
6. `t-image-delete-landing` (A, the landing point): image removal for a path identifier behind a
   null-session test only (`ProfileController.java:241-253`, `ProfileServiceImpl.java:461-466`).
   Dismissal: the null-session test looks like the authorization check.

Coupled must-keep-working next to every lever: the owner's own change and the administrator's change of
someone else's profile (the over-broad `ff_refuse_all.patch` and `ff_no_superuser.patch` prove the
functional tests catch it), plus other users' profile information staying readable.

## Injected siblings: full candidate list and why the picks won

Every candidate found by reading the tree (screener O8/O8b leads plus an independent search of
`ProfileService` callers, profile mutators and profile writers):

1. `ProfileServiceImpl.saveOfficialImageUrl` (real, unchecked, LTI caller) - PICKED as the Pattern B
   lever (real upstream code; not injected).
2. `SakaiProxyImpl.toggleProfileLocked` (real service method, no ownership check; its only caller is
   the orphaned `profile2/tool` module, which is not in the Maven reactor) - PICKED as an injected
   sibling by adding a web route plus a service wrapper, so it becomes reachable through the real
   entry point.
3. A direct writer for the profile's social links - PICKED as an injected sibling; it is a second
   writer of the same fields the combined profile save writes.
4. `ProfileImageEntityProvider` (profile2/tool) image-remove action and stubbed CSRF check - rejected:
   the module is not in the reactor and its sources import classes that no longer exist, so it cannot
   be exercised.
5. `ProfileDaoImpl.saveProfileImage` / `removeProfileImage` / `saveSocialNetworkingInfo` - rejected:
   internal data-access primitives, not product entry points.
6. `SakaiProxyImpl.updateSakaiPerson` / `saveFile` - rejected: internal write primitives.
7. `setProfileImage` - already checked at the pinned commit; kept as the precedent the fix follows and
   as a functional control, not a lever.
8. `UserPictureSetterImpl` (lti) - a caller, not an entry point; its self-call is a functional test.
9. `entitybroker` UserEntityProvider, `roster2` SakaiProxyImpl, `portal` SkinnableCharonPortal - read
   or availability uses only.
10. The audio branch of `saveUserProfile` - same method, covered by lever 1.

The two injected picks are the most complex of the viable candidates: both are reachable through a real
HTTP entry point, both survive a fix that covers only the published sites, they sit far from the
reported picture-deletion site, and each has a different reason a solver would skip it. The rejected
candidates are either unreachable (4) or not real entry points (5, 6, 8-10).

## What was verified

- The pinned tree and the injected baseline compile; the 69-module dependency reactor installs in about
  one minute warm and the offline `mvn -o` rebuild of the four affected modules takes seconds.
- The project's own tests pass at the pinned commit: `ProfileServiceTests` 7/7, webapi 22/22.
- On the vulnerable baseline: all 14 hidden security tests fail, all 31 functional tests pass.
- On the oracle: 14/14 security and 31/31 functional pass, reward 1.0 in the real verifier container.
- Every `build/sakai-s4/checks/*.patch` was applied to a clean injected baseline and run through the
  full suite locally; each behaves as declared (`security_fail` has at least one security failure and
  no functional failure; `functional_fail` has at least one functional failure; `pass` is 1.0).
  `pass_alternative.patch` was also run through the real verifier container and scored 1.0.
- The hidden tests reference only API that exists at the pinned commit, so they compile against a
  submission that uses any valid design.

## What could not be verified

- The blind patch: written downstream by the pipeline, as instructed; only declared in the manifest.
- The Pattern B register row records `present_in_latest = yes` from a read-only look at upstream master
  on 2026-10-30; no public upstream report of that gap was found (`public_upstream_report = unknown`).

## Gate results (run one stage at a time on this VM, 2026-10-30)

- `static`: PASSED.
- `nop`: PASSED - 14/14 hidden security tests fail on the pinned+injected tree, 31/31 functional pass,
  reward 0.
- `oracle`: PASSED - three trials, reward 1.0 each, identical results (14 security + 31 functional).
- `patches`: PASSED - all 16 declared checks behave as declared: 10 `security_fail`, 4
  `functional_fail`, `pass_hardening` 1.0, `pass_alternative` 1.0; `blind.patch` is declared and is
  written downstream.

## Fairness notes

- The property is stated once and covers the direct service callers because the product calls the
  profile code from another module; the code shows that call site.
- Reads stay allowed, and a functional test proves another person's pronunciation recording remains
  readable, so an over-broad read guard is caught.
- The administrator exemption is preserved and tested for every mutator.

## Outside scope (one line)

Profile reads (images, pronunciation) for any identifier and the server-side fetch of an
institution-supplied picture URL were not pursued; the advisory protects modification only.
