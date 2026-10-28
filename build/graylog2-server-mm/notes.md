# graylog2-server-mm — build notes

- Start: 2026-10-28T07:03:01Z (build-run start).
- End: 2026-10-28T07:47:30Z (patches stage finished).

## Gate results
- `static`: PASS (after fixing `schema_version`).
- `nop`: PASS — 11 security tests fail, 26 functional tests pass on the pinned+injected tree.
- `oracle`: PASS — 3 runs, reward 1.0, identical security/functional maps.
- `patches`: PASS — all 12 declared checks behave as declared:
  - `security_fail`: miss_view_check (5 view cases), miss_path_id (identity case),
    miss_empty (unshare-all), miss_one_type (saved-search case), miss_ed/miss_en/miss_sr
    (their two cases each), crash_as_refusal (5 view cases), check_after_adjustment (5 view cases).
  - `functional_fail`: func_overbroad (1 hidden + 2 project cases).
  - `pass`: hardening 1.0, alt_fix 1.0.
  - `blind`: declared only; written later by the pipeline.


## What the task is
Pattern B (uncovered routes) plus injected siblings, on Graylog's saved-object sharing model.
The reported flaw: a caller with edit permission but not ownership can change a view's grants
through the update request's embedded sharing instruction.

## Levers (one line each)
- T1 `views_update_share` (B, reported): `PUT /views/{id}` applies the share request after only
  the edit-permission check — `ViewsResource.java:393-404`. Obvious route.
- T2 `views_identity_mismatch` (B, real upstream): the sharing is applied to the request target
  while the body can name another view, so a guard built from the body entity id protects the
  wrong object — `ViewsResource.java:396-402`. Dismissed as "the frontend always sends matching ids".
- T3 `views_unshare_all` (B, input shape): a sharing instruction naming no grantee removes every
  grant, so a guard that only fires for a non-empty instruction misses it — `ViewsResource.java:288,402`.
- T4 `event_definitions_update_share` (injected): event-definition update accepts a share request
  and applies it after the edit check — `EventDefinitionsResource.java:343-374`. Looks like the
  create route's save-and-share convenience.
- T5 `event_notifications_update_share` (injected): same shape for notifications —
  `EventNotificationsResource.java:212-235`. Edit rights look like enough authority over a config object.
- T6 `streams_update_share` (injected): same shape for streams — `StreamResource.java:389-404`.
  Stream management looks administrative and create already takes the same wrapper.

## Verified
- The reported flaw reproduces at the pinned commit through the real resource method (behavioural
  test on the pinned+injected tree: 11/11 security cases fail, 26/26 functional pass).
- T2 reproduces: on the pinned tree a request whose body names an owned view and whose target is
  another view changes the target's grants. Current upstream instead rejects a body/target id
  mismatch, so it is absent from latest.
- All 12 wrong-fix/alternative patches compile against the prebuilt classpath; each behaves as
  declared when run through the same harness (miss_*: targeted security cases fail, functional
  all pass; crash_as_refusal and check_after_adjustment: the five view-route security cases fail,
  functional all pass; func_overbroad: one functional case fails; oracle, hardening and alt_fix:
  all 37 pass).
- The project's own tests for the area (ViewsResourceTest with its helpers, and
  EventDefinitionsResourceTest) pass on both the vulnerable tree and the oracle.
- Offline build: the graylog2-server module builds with `-Dskip.web.build=true`
  (`mvn ... -pl graylog2-server -am install`), ~2 minutes warm; the full initial dependency
  population plus build fits the 1800 s image-build budget on this host.
- The pinned commit does not contain the published fix's regression tests (the fix commit adds
  `throwsExceptionWhenUpdatingSharingOfViewUserDoesNotOwn` / `updatesSharingWhenUserOwnsView`;
  the pinned ViewsResourceTest has neither).
- The verifier recompiles only product files that differ from a pristine prebuilt baseline, so
  the injected sibling files (which differ) and the submission's edits are always compiled.

## Could not verify
- The two dismissed content-pack routes were not driven behaviourally: installation needs an
  admin-level permission and a full content-pack graph, and the upgrade path has no REST caller
  in this repository. They are recorded in `build/audit/uncovered-routes.tsv` as not built.
- Whether any real (non-test) `SyncedEntitiesResolver` implementation exists outside this
  repository (none found here) — the implicit-grant propagation noted by the screener is
  therefore out of scope.
- The exact behaviour of the real Shiro realm for a subject that owns a GRN through a team grant;
  the harness models ownership as a per-GRN permission, which is the same decision the fixed code
  asks for.
- The image build was not run end-to-end before the gate (the gate's stages perform it).

## Fairness notes
- The security tests observe the sharing decision at the resource boundary: they stub
  `EntitySharesService` and assert it is never invoked on a refusal. A fix implemented inside the
  sharing service itself would not be observed; the product's architecture places ownership
  checks in the REST layer (the dedicated shares endpoint does exactly that), and the instruction
  states the refusal contract, so this matches the intended design.
- The harness's authority stub answers by exact permission string and by GRN, so both the
  `entity:own` permission form and the string form are accepted; the alternative fix uses the
  string form and scores 1.0.

## Outside the advisory's scope (not built)
- Content-pack install/upgrade sharing of reused entities; implicit grant propagation to synced
  entities. Noted in the manifest and the register.
