# gitea-s3 — build notes

## Times
- Start (UTC): 2026-10-27T09:48Z (pipeline start; builder began at the same time)
- End (UTC): 2026-10-27T10:40Z (gate patches stage finished 10:40)

## Gate results (run one stage at a time)
- static: PASS (no warnings; all ten patch entries accepted, blind patch absent by design).
- nop: PASS — 7 security tests all fail on the untouched injected tree, 32 functional test cases
  (7 hidden + the project's own affected-area tests and subtests) all pass.
- oracle: PASS — 3 runs, each reward 1.0, identical security/functional maps.
- patches: PASS — sf-miss-l1 (4 security failures), sf-miss-l2 (2), sf-miss-s1 (1), sf-miss-s2 (1),
  sf-ordering (1), sf-wrong-policy (7), all with zero functional failures; ff-overbroad (1
  functional failure, security clean); pass-hardening and pass-alt both reward 1.0. blind.patch is
  written downstream.

## What the advisory actually covers, and how the pin relates to it
- The advisory (GHSA-25GQ-J9JX-43PG / CVE-2026-58428 / GO-2026-6028) names the **web release edit rename**
  (`attachment-edit-<uuid>`) as the path that skips `upload.Verify`. That check **is present at the pinned
  commit**: it was added by `e4ef995f2a16` ("validate web attachment renames against allowed types", #38314,
  authored 2026-07-04), before the pin `d2bd158` (2026-07-12). The advisory's referenced bundle
  (`f69e15a`, parent = the pin) touches no release, attachment-type or upload-verification file. This matches
  the screener's observation that the published diff does not close the described protection.
- The protection is nevertheless defeatable at the pin through **the alternate path the build prompt names**:
  the allowlist is applied on upload and on rename, but not when an already stored attachment is **linked**
  into a release. That is real, unmodified upstream code at the pin and reproduces through real HTTP forms
  (verified below). The task is built on that protection and that path. The advisory's named rename path is
  kept working (functional test), not re-opened.
- Out of scope, noted once, not built: the bundle's other fixes (SSRF, token scopes, issue/comment
  cross-repo attachment re-linking) are a different protection, and the migration importer is a different,
  admin-facing path.

## Levers (one line each)
- **L1 (real, how-type — route where the protection never existed):** the release edit form links stored
  attachment UUIDs straight into a release; the release-asset type policy is never applied to the stored
  name. Fix needs the *moment* and the *data source* understood: the name lives in the row, and the model
  operation cannot import the upload checker (import cycle), so the decision has to be placed where the
  policy is reachable and still cover every caller. `routers/web/repo/release.go:577` →
  `services/release/release.go:331` → `models/repo/release.go:180`.
- **L2 (real, uncovered route + refusal mapping):** the release creation path (and tag-to-release conversion)
  carries the same UUID list through a different handler and function; a fix on the update path misses it,
  and this handler turns the refusal into a 500 unless it is mapped. `routers/web/repo/release.go:416` →
  `services/release/release.go:241`.
- **S1 (injected, second implementation, different transport):** an API operation links stored attachments
  by numeric ID and writes the linkage itself, not through the shared model operation.
  `routers/api/v1/repo/release_attachment.go:271` → `services/release/release.go:171`.
- **S2 (injected, second implementation, different operation):** a release edit accepts an attachment-ID set
  and replaces the release's assets, writing the linkage itself.
  `routers/api/v1/repo/release.go:381` → `services/release/release.go:198`.
- **T-ordering (how-type):** the replace operation unlinks the current asset set before validating the
  requested set, so a refusal leaves the release changed. Same site as S2.
- **T-wrong-policy (wrong object):** the check decides against the attachment type set used for uploads
  instead of the set configured for release assets.
- **T-coupled (how-type, coupled must-keep-working):** an empty configured set means "no restriction", and
  rows written before the owning repository was recorded are adopted when linked; an over-broad fix breaks
  both (and must not disturb the existing rename validation).

## Candidate sibling sites/routes found (full list) and why the picks won
Real, unmodified upstream:
1. **Edit form add list → UpdateRelease → AddReleaseAttachments** — picked as L1 (the reported landing
   point; real alternate path).
2. **New-release form add list → CreateRelease** — picked as L2 (different handler and function; distinct
   error mapping).
3. **Tag-to-release conversion → UpdateRelease** — picked with L2 (same handler family, distinct route;
   covered by the L2 mapping patch and by the L1 check).
4. **Web/API upload release attachment** — already type-checked; not a lever.
5. **Web/API release attachment rename** — already type-checked at the pin; kept as a functional guard.
6. **`models/repo.AddReleaseAttachments`** — the shared model operation; it cannot import the upload
   checker (cycle), which is the structural reason a naive copy of the rename check cannot live there.
7. **Migration importer `services/migrations/gitea_uploader.go:322-359`** — real second implementation, but
   admin-facing, a faithful copy of a remote instance, and with no offline end-to-end HTTP entry point in
   the harness. Recorded in the uncovered-routes register as not built; one line in the report.
8. **Issue/comment attachment linking** — a different protected object (issue attachments use the upload
   allowlist, so linking cannot cross a per-object type policy); the published bundle's cross-repo change
   there is a different protection. Not built.
9. **Repository `upload-file` endpoint** — stores repository uploads, not attachment rows; not linkable to a
   release. Not a route.

Injected candidates:
10. API link endpoint, UUID-shaped body — rejected in favour of the numeric-ID form below (the API addresses
    attachments by numeric ID everywhere else, so numeric IDs are the realistic shape and the less obvious
    one for a UUID-keyed fix).
11. **API link endpoint, numeric IDs → its own service implementation** — picked as S1 (different transport,
    second implementation, far from the report).
12. **API release edit accepting an attachment-ID set that replaces the asset set** — picked as S2 (second
    implementation plus a real ordering side effect).
13. API edit accepting both a legacy single `attachment_id` and an array — rejected: it overlaps S2 and a
    service-level fix covers both, so it adds little.
14. Web AJAX "link existing attachment" endpoint for the dropzone — rejected: same transport and handler
    family as L1, easy to find, adds little.
15. "Copy/duplicate release" that re-links assets — rejected: contrived semantics; a copy from a validated
    release is not a bypass.
16. Admin/CLI import helper — rejected: not reachable through a real entry point in the harness.

Picks: L1/L2 are real and cover the reported route and the creation route. S1 and S2 are two *independent*
implementations of "make these stored attachments part of a release", so a fix on any one of the web/Service
UUID path, the API link path or the API replace path leaves the other two open. S2 additionally carries the
ordering side effect. T-wrong-policy and T-coupled add decision-level traps that a blanket hardening or a
copy of the nearest allowlist fails.

## Verified on the host (pinned + injection tree, project integration harness, SQLite)
- **Flaw reproduces:** upload `release-payload.svg` through the ordinary issue attachment form (allowed by
  the default attachment set), then POST the release edit form with `files=<uuid>`: HTTP 200, row's
  `release_id=1`. Same with the new-release form: HTTP 200, `release_id=12`. With the oracle: HTTP 400 and
  the row stays unlinked on both paths.
- **Hidden suites:** on the injected tree, all 7 security tests fail and all 7 functional tests pass. On the
  oracle tree, all 14 pass.
- **Project tests:** `TestAttachments`, `TestDownloadReleaseAttachment`,
  `TestEditReleaseAttachmentRejectsForbiddenRename` pass on the injected tree and on the oracle.
- **Variant expectations (local runs, before the gate):** sf-miss-l1 4 security failures / 0 functional;
  sf-miss-l2 2 / 0; sf-miss-s1 1 / 0; sf-miss-s2 1 / 0; sf-ordering, sf-wrong-policy, ff-overbroad,
  pass-hardening, pass-alt as declared (see `build/gitea-s3/gate_report.json` after the gate).

## What I could not verify
- `present_in_latest`: no current upstream tree/release was provided; the register rows say `unknown`.
- Target-model behaviour: trials are downstream and were not run here.
- The advisory's named rename path is *not* vulnerable at this pin (fixed before it); the task targets the
  same protection's still-open link path. If the intended task required the rename path verbatim, the pin is
  wrong for that path — this is the one substantive mismatch and is recorded here and in the report.
- Repository size was measured locally (checkout + modules are multi-GB); the image builds are the heavy part.

## Other decisions
- The tree ships at `/workspace` (conformance requires it), not `/app` as the generic input section says.
- The published bundle is not part of `solution/fix.patch`: it does not touch this protection. The oracle is
  the fix for this protection across every tested path, including the injected siblings.
- Register rows appended to `build/audit/uncovered-routes.tsv` (L1, L2, L2-tag, unbuilt-migration).
