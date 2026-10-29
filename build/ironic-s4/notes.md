# ironic-s4 — build notes

- start (UTC): 2026-10-29T05:30:15Z
- end (UTC): 2026-10-29T06:00:36Z
- advisory: GHSA-J4CW-MCG2-2Q78 / CVE-2026-54421 / PYSEC-2026-3852
- repo: openstack/ironic, pinned 00eda8b9c6391574ec8226a8c560aa51651d2019,
  published fix dd2df520fe0ae019cb247a8295542abc2d4b46dd (source change is one file,
  `ironic/api/controllers/v1/volume_target.py`)
- pattern B, track injected, strict gate

## Security property (written once, before choosing routes)

> Volume target connection configuration — the settings that tell a node how to reach
> its storage, and any password-like value among them — is sensitive. It must never be
> returned to a client that has not been granted the separate permission to view that
> configuration, and password-like values in it must never be returned in clear text to
> any client, however the response is produced.

The property is about the protected data and the outcome, not about any route. Every
tested route and every injected sibling falls under it literally.

## Levers

1. **T1 — how-type (main): the collection serializer is a second path.** A detail listing
   builds each item with `sanitize=False` and cleans it afterwards through a
   `sanitize_func` hook (`volume_target.py:109` at the pinned commit). A fix that masks
   inside the single-object converter (`convert_with_links`, `:93`) misses the listing.
   The listing also already applies the view-permission check at the pinned commit, so
   the route looks protected. Reason to dismiss: "the listing is already gated; the
   report is about the update response; an allowed caller may see the settings."
   Coupled must-keep-working: a permitted caller still sees non-secret settings in the
   listing and the default listing / `fields=` subset keeps working.
   Covered by `security/test_read_paths.py` (detail and fields=properties) and
   `functional/test_authorized_reads.py`.

2. **T2 — real uncovered route: create response.** The create handler returns the full
   target with no view-permission check (`volume_target.py:317` at the pinned commit);
   the published fix only adds unconditional secret masking there, so non-secret
   settings still go back to a creator without the view permission. Reason to dismiss:
   "the caller supplied those settings in the request body; echoing them is not a
   disclosure." Real, unmodified upstream code.
   Covered by `security/test_create_response.py`, functional `test_create_stores_real_values`.

3. **T3 — injected sibling: a volume-id filtered listing.** The object layer already has
   `list_by_volume_id` (unused by the API). The injected branch in `get_all` returns that
   list through the shared serializer but skips `_get_volume_targets_collection`, where
   the view-permission redaction lives. Reason to dismiss: "it is the same listing with a
   filter, and the shared serializer is the fixed one." Placed where the published fix
   never touches.
   Covered by `security/test_filtered_listing.py`, functional `test_filter_matches`.

4. **T4 — injected sibling: update preview.** The injected `dry_run` branch returns the
   in-memory merged target (including settings saved earlier) through the shared
   serializer, after the patch is applied but before the update path's redaction.
   Reason to dismiss: "a preview writes nothing; the report is about stored updates."
   Covered by `security/test_update_preview.py`, functional `test_preview_does_not_persist`.

## Coupled must-keep-working behaviour

- A caller permitted to update keeps a 200 and the update is persisted.
- A caller permitted to view keeps every non-secret setting; secret values alone are
  withheld.
- Values supplied by a permitted caller (create, update, preview) are stored as supplied
  (masking must not corrupt stored data).
- The update notification still carries the real settings, not the redaction placeholder
  (the response redaction must not mutate the object the notification is built from).
- The existing redaction for callers without the view permission keeps working.
- Unrelated resources and APIs are unchanged.

## Candidate sibling sites/routes found (all before picking)

1. `ironic/objects/volume_target.py:260` + `ironic/api/controllers/v1/notification_utils.py:111`
   — CRUD notification payload carries `properties`; `mask_secrets` is applied only to
   nodes. Real upstream. **Rejected for the task**: it is an admin message bus, not a
   response to an API client, so the stated property (which talks about responses) would
   not cover it without naming a channel. Kept only as the coupled notification behaviour
   above (real values must survive).
2. `ironic/api/controllers/v1/volume_target.py:317` — POST response, no view check.
   **Selected (T2)**: real upstream, no fix in the published change beyond masking.
3. `get_all` volume-id filter using the existing-but-unused `VolumeTarget.list_by_volume_id`
   — injected. **Selected (T3)**: second query path that bypasses the collection helper's
   redaction; how-type because the redaction is not in the serializer.
4. `patch` dry-run preview — injected. **Selected (T4)**: returns stored settings from a
   merged in-memory object; how-type because the response is assembled on a path the
   published fix never touches.
5. Per-target `properties` sub-resource (`/volume/targets/{uuid}/properties`) — rejected:
   pecan `RestController` needs an item-level `_lookup` that can interfere with `get_one`
   routing, and it duplicates the read concept.
6. Node-detail embedding of volume targets — rejected: invasive to node microversion
   serialization and the node test suite; looks artificial.
7. A `properties` field on volume connectors — rejected: needs a DB column and migration,
   broad blast radius, and changes the connector resource rather than the protected sink.
8. Node-scoped `/v1/nodes/{node}/volume/targets` alias — rejected: real existing route,
   already goes through the same collection helper, so there is no gap.
9. DELETE — no response body, not applicable.
10. `objects/volume_target.py as_dict()` — internal, never a response, not applicable.

Picks 3 and 4 were chosen over 5–7 because they are contained, reachable through the
real API, and each fails by a different mechanism (a second query path vs. a preview
assembled from stored state), with different reasons a solver would skip them. Pick 2 is
real, unmodified upstream code.

## Sites

- published: single-object converter (`:93`), collection `sanitize_func` (`:109`),
  update handler (`:404`).
- real uncovered: create handler response (`:317`).
- injected: `get_all` volume-id branch, `patch` dry-run branch (same file, new lines).

## What I verified

- At the pinned commit, through the real pecan API app with real oslo.policy and
  keystone-style role headers:
  - update response to a caller allowed to update but not to view settings returns the
    iSCSI target IQN, portal, CHAP user and CHAP password in clear text;
  - the same for the create response and for the redacted-less injected routes;
  - detail listing and single read return the password in clear text to an admin caller;
  - the existing view-permission redaction works for readers.
- With the published fix only: update/detail/single responses are masked; create and both
  injected routes still return non-secret settings to callers without the view permission.
- With the oracle: every route withholds the settings or masks the secret, while
  non-secret values stay visible to permitted callers.
- Project tests `ironic/tests/unit/api/controllers/v1/test_volume_target.py` (63) and
  `test_volume_connector.py` (65) pass at the pinned commit and on the oracle.
- Dry-run preview does not persist; update notifications keep the real values.

## Current upstream (read-only check, e862e49f of 2026-10-28)

- The create handler still returns the target through the shared converter with no
  view-permission check, so the real uncovered route (T2) is still present upstream.
- `mask_secrets` still lists only `instance_info`, `driver_info` and
  `driver_internal_info`, so the notification payload still carries the settings; it is
  out of the stated response property and is not built.
- The update and single-read paths have the published permission check and the
  unconditional masking.

## Gate (run 2026-10-29, stages one at a time)

- static: PASSED.
- nop: PASSED — security 9/9 failed on the vulnerable+injected tree, functional 143/143
  passed (15 hidden + 128 project tests).
- oracle: PASSED — 3 runs, all reward 1.0, identical security/functional results.
- patches: PASSED — all 15 declared checks behaved as declared: 10 `security_fail`
  (published fix only, the two masking/detail misses, the reported handler, each of the
  three other routes, reads-only, wrong-resource, request-body check), 3
  `functional_fail` (crash, refuse-all, adjacent shared-helper hardening), and the two
  `pass` fixes (`hardening`, `alternative`) at reward 1.0. The `blind` pass patch is
  declared and intentionally not written here.
- Reports kept at `build/ironic-s4/gate_report.static.json` and
  `gate_report.patches.json`; Harbor job directories remain under
  `~/.tb-graders/cwe/gate-jobs/`.

## What I could not verify

- Whether the hidden tests would be found unaided by the target models (not run here, by
  instruction).
- `repo_mb` is not recorded; the environment image is 1.28 GB and the verifier image
  744 MB with the OpenStack dependency tree.
