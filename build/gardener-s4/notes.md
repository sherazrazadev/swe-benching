# gardener-s4 — build notes

- start UTC: 2026-10-29T01:57Z
- end UTC: 2026-10-29T02:42Z
- repo: gardener/gardener, pinned (vulnerable) c3f8b61ec40efbe001458770bf6282c4cdd8b6c7
- published fix: 63751db97dca6cc5ee5f966d4963415de6ae5545 (direct child of the pinned commit)
- advisory: GHSA-GFJV-GQF2-C888 / CVE-2026-79767 / GO-2026-6568 (never in instruction.md)
- track: injected; pattern B; builder_prompt_version build-v1

## Security property (written once, before routes)

Only a change that is authorized for a project's `manage-members` permission may add a user or a
group to that project's access, remove one, or change the roles that give it access. The rule holds
for every project update, for every project state, for every way the access is recorded or applied,
and whoever sends the request. Service accounts are the only subjects whose project access may be
changed by an ordinary project update; a subject is a service account when it is of kind
ServiceAccount or when its user name is `system:serviceaccount:<namespace>:<name>`, and nothing else
is a service account.

## Levers

- **T1 (real code, Pattern B, how-type: route where the protection never existed).** A Project whose
  stored `.spec.owner` is nil: `userIsOwner` returns true for every requester, so `mustCheckProjectMembers`
  returns false and `mustCheckProjectOwner`'s "initial owner" branch lets any updater install an
  arbitrary owner. `plugin/pkg/global/customverbauthorizer/admission.go:303-305,359-362,270-272`.
  Reason to dismiss: the code comment says nil means "the creator will be defaulted to the owner";
  `.spec.owner` is documented as deprecated and API validation refuses to reset a set owner, so a
  solver assumes the state cannot exist. It does exist for projects stored before owner defaulting,
  and validation explicitly allows setting an owner when the stored one is nil.
- **T2 (real code, shape trap).** A `kind=Group` subject whose name looks like a service-account
  identity (`system:serviceaccounts:*`, `system:serviceaccount:*:*`) is a group, not a service
  account; it must stay protected. `plugin/pkg/global/customverbauthorizer/admission.go:343-345`.
  Reason to dismiss: the docs define service-account subjects by the `system:serviceaccount:` name
  form, and a plausible one-line widening of the classifier hoists the name-prefix exemption out of
  the kind check. `system:serviceaccounts` is the real group of all service accounts, so granting it
  project access grants every service account.
- **T3 (injected, how-type: merged/stored-configuration route; producer off the check's path).**
  `pkg/component/garden/projectrbac/accessoverlay.go` (new file) makes the project RBAC renderer merge
  extra subjects from a ConfigMap in the project namespace; `Deploy` appends them to the admin/member/
  uam/viewer/manager subject lists. The admission check never sees it. Reason to dismiss: it is
  stored configuration for extension integration, and the project's member list is the only input a
  reviewer inspects. The published fix never touches this package.
- **T4 (injected, how-type: requester/subject confusion).** `plugin/pkg/global/customverbauthorizer/compat.go`
  (new file) skips the member check when the *requesting* user is a service account, called from
  `admitProjects`. Reason to dismiss: the docs say service-account *subjects* are managed outside the
  user-access-management flow and another admission plugin in the tree treats service-account
  requesters as automation, so the conflation reads as intended trust. The published fix never
  touches this file.

## Coupled must-keep-working behaviour (functional)

- T1: a newly created project whose owner is not yet recorded still lets its creator add members;
  the recorded owner can still transfer ownership and change members.
- T2/T4: service-account subjects (kind ServiceAccount, and users named `system:serviceaccount:*`)
  stay addable/removable/re-roleable with plain update permission; a service-account requester that
  holds `manage-members` still succeeds.
- T3: ordinary project access rendering (owner, member, viewer, uam, service-account-manager,
  extension roles) keeps working, with and without unrelated stored configuration present.
- All: authorized member changes (users and groups) still apply; non-member updates keep succeeding.

## Candidate sibling sites and routes, and why the picks won

Every site/route found while reading the pinned tree (screener O8/O8b plus own search):

1. owner-entry exemption in mustCheckProjectMembers (O8 route 1) — dropped: the project owner is
   already bound to the admin ClusterRole (which carries `manage-members`) by projectrbac, so
   changing the owner entry grants no access the owner does not already have; no real impact.
2. nil-owner state (O8 route 2) — PICKED (T1). Real, reachable through the admission entry point,
   real impact (install an arbitrary owner / add members), strong dismissal reason.
3. pkg/api/core/validation/project.go ProjectMemberProperties/ProjectMemberId (O8b 1) — dropped:
   validation cannot grant access and the admission check does not depend on its output; a gap there
   does not change any grant.
4. pkg/component/garden/projectrbac consumer (O8b 2) — PICKED (T3) as an injected second data source.
   It is the only code that turns project data into real access, so a producer there is a genuine
   route to the protected outcome and is far from the report's landing point.
5. pkg/apis/core/v1beta1/conversions.go owner-role injection (O8b 3) — dropped: the identity
   comparison there agrees with the admission key for every subject shape the API accepts
   (User/Group are forced to the rbac API group by validation, ServiceAccount to the empty one), and
   forward/reverse conversion are symmetric, so a plausible gap did not produce a grant the
   admission check had not already compared.
6. customverbauthorizer admission for NamespacedCloudProfile/Shoot — dropped: different custom
   verbs and different protected data.
7. project mutator ensureOwnerIsMember (real) — considered as a producer; dropped because it runs
   before the validating check, so the check sees its output.
8. status subresource of Project — dropped: the status strategy overwrites spec from the stored
   object, so no member change persists.
9. deletionTimestamp/SkipVerification skip — dropped: a client cannot set deletionTimestamp, and
   during real deletion member grants are meaningless.
10. service-account *requester* trust (injected) — PICKED (T4): a different concept from T3, in the
    admission path, with the real precedent of `plugin/pkg/global/deletionconfirmation` treating
    service-account requesters specially, so it reads as maintained intent.
11. Group subjects that look like service-account identities — PICKED (T2): real, one-line plausible
    wrong fix, real group (`system:serviceaccounts`) with cluster-wide impact.

T1 is the main how-type lever (state/operation distinction); T3 and T4 are the two injected
siblings, both how-type, in different packages, with different dismissal reasons. T2 is a shape trap
that only catches a particular wrong fix (it is not counted as a main lever).

## Verified / not verified

- Verified: pinned commit is the direct parent of the published fix; the fix diff touches only
  customverbauthorizer admission.go + its test; validation refuses to reset a set owner and allows
  setting one when it is nil; the project mutator defaults the owner only on CREATE; projectrbac
  renders owner + members into ClusterRoleBindings; the pinned project tests pass; the injected
  tree builds and the relevant packages test clean (see end of file).
- Verified by test (gate, in order): `--only static` passes every builder-owned check (only the
  externally-wired blind pass patch is missing); `--only nop` PASS with 16 security cases failing on
  the vulnerable tree and 14 functional cases passing; `--only oracle` PASS 3/3 runs at reward 1.0
  with identical results; `--only patches` PASS with all 11 check patches behaving as declared
  (security_fail: miss_nil_owner 4 sec failures, miss_sa_groups 4, miss_overlay 2, miss_sa_requester 1,
  published_fix_only 7, functional 14/14 passing in each; functional_fail: refuse_all 11, crash_on_denied 2,
  wrong_resource 1, additions_only 1; pass: hardening and alt_fix reward 1.0).
- Also verified by test outside the gate: every security test fails on the injected pinned tree and
  passes on the oracle; every functional test passes on both; each check patch applies with
  `patch -p1` and behaves as declared in the local container.
- Read-only look at current upstream (master, 2026-10-29): `userIsOwner` still returns true for a
  nil owner and both owner helpers are still not operation-aware, so T1 is present in latest (yes);
  `isServiceAccountSubject` still protects every group, so the T2 shape route is closed there (no).
- Could not verify: behaviour of a live gardener-apiserver+controller-manager pair (no cluster in
  this environment); the "present in latest" state of the injected siblings (they are ours); the
  exact historical prevalence of nil-owner projects (inferred from the mutator/validation split,
  which only defaults the owner on CREATE while validation explicitly permits setting one when none
  is stored).
- Fairness notes: T1 needs a stored project with no owner, which new creates cannot produce but
  legacy objects can, and the API still accepts assigning an owner to them; T3 requires auditing the
  renderer that turns stored data into access, which the instruction describes at product level only;
  the pinned customverbauthorizer test fixtures omit the RBAC API group, so any correct fix fails
  them as written (the upstream fix commit rewrote exactly those fixtures), and the functional group
  therefore restores a fixture-corrected copy.

## Out of scope noticed

- `pkg/component/gardener/dashboard/rbac.go` also consumes project members for the dashboard
  deployment; separate component, not part of this advisory, not built on.
