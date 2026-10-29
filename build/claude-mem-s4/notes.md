# claude-mem-s4 build notes

- Start (UTC): 2026-10-29T01:44:54Z
- End (UTC): 2026-10-29T03:13:21Z

## Mechanism

The product gives an incoming memory entry an identity derived from its content and skips the
write when an entry with the same identity was recorded in the recent window. At the pinned
commit `computeObservationContentHash` concatenates `memory_session_id`, `title` and `narrative`
with no field boundary, truncates the SHA-256 to 16 hex characters, and the dedup query trusts
that string as an exact key. Two different entries whose fields re-split the same character
stream are indistinguishable and the second is silently dropped. The published fix joins the
same three fields with `\x00`; it leaves the identity ambiguous for values that contain the
delimiter, ignores every other content field, and does not touch any of the other identity
sites below.

## Levers

- base (A) `src/services/sqlite/observations/store.ts:19-28` — unseparated concatenation, used by
  the save route, the transaction path and the legacy store. Reason to dismiss: none; the report
  names it.
- delimiter shape (A, how-type) same function — a value containing the join character plus a
  boundary shift across it reproduces the joined string; the published `\x00` join and any other
  single delimiter fail on their own delimiter. Reason: a separator looks unambiguous.
- field-set shape (A, how-type) same function — the identity covers only session/title/narrative;
  entries differing in facts, concepts, file lists, type or subtitle merge. Reason: the function
  documents those three as the semantic identity.
- uncovered import (B, how-type) `src/services/worker/http/routes/DataRoutes.ts:62,358 ->
  src/services/sqlite/SessionStore.ts:2364-2397`, duplicate at
  `src/services/sqlite/import/bulk.ts:126-189` — duplicate decided from
  `(memory_session_id,title,created_at_epoch)` only, content_hash left NULL. Reason: a restore
  path for an external export with its own exact-millisecond key.
- uncovered cleanup (B, how-type) `src/bin/cleanup-duplicates.ts:17-22,52-57` — groups by
  session/type/title/subtitle and deletes the rest. Reason: a manual maintenance command that
  prints its deletions.
- injected S1 summary (how-type) `src/services/sqlite/summaries/store.ts:16-44,70-75` (+ schema
  column + migration + write-path wiring) — content-hash dedup over all summary fields, joined
  without a boundary. Reason: a different record kind, so out of the report's scope.
- injected S2 search copy (how-type) `src/services/sync/ChromaSync.ts:124-137` — observation
  vector documents keyed by `session+title+narrative` truncated, so a different entry upserts over
  another's document. Reason: derived, best-effort data; the database row is the source of truth.

## Candidate list and why the picks won

Every place that derives or compares a content identity, found by searching `createHash`,
`content_hash`, `dedup`/`duplicate`, `GROUP BY` and equality pre-checks:

1. `computeObservationContentHash` and its six call sites — picked (base).
2. Session-summary hash dedup — did not exist upstream; injected and picked (S1).
3. Chroma vector document id — derived from the row id upstream; injected content-derived and
   picked (S2): far from the store, plausible idempotency motive.
4. `SessionStore.importObservation` — picked (import route).
5. `import/bulk.ts` `importObservation` — a real second copy of the import decision; folded into
   the import lever and tested (strongest form: a second implementation).
6. `cleanup-duplicates.ts` observation grouping — picked (cleanup route).
7. `cleanup-duplicates.ts` summary grouping — same defect; closed by the oracle, not tested
   separately (same concept).
8. `bin/import-xml-observations.ts` pre-checks (observations and summaries) — real partial-tuple
   pre-checks; closed by the oracle (pre-check removed, store dedup used), not tested separately
   because it is the same concept as the import route and needs a hard-coded transcript path.
9. migration 22 random `content_hash` backfill — rejected: the random value is not
   content-derived, so it causes missed dedup (duplicates), not a merge of different entries;
   the opposite direction from the reported impact.
10. `plugin/scripts/*.cjs` stale bundles — rejected: minified build artifacts of an older source
    tree; testing them would test an older product. Out of scope note below.
11. `scripts/translate-readme/index.ts` sha256 prefix — unrelated translation cache key; out of
    scope note below.

## Verified

- Pinned commit is the first parent of the published fix; the fix diff is one line in
  `observations/store.ts` plus a regression test. The regression test is not present at the
  pinned commit.
- Vulnerable (pinned + inject.patch): security 17 fail, functional 14 pass, project 45 pass.
- Oracle (pinned + inject + fix.patch): security 17 pass, functional 14 pass, project 45 pass.
- Every check patch behaves as declared (local runs): sec_miss_base 11/6 sec, sec_miss_delimiter
  16/1, sec_miss_fields 14/3, sec_miss_import 14/3, sec_miss_cleanup 14/3, sec_miss_summary
  14/3, sec_miss_chroma 15/2, sec_wrong_resource 14/3, sec_published_only 2/15 — all with
  functional and project passing; func_overbroad/refuse_all/crash fail functional; hardening and
  alt_fix pass everything.
- inject.patch and fix.patch apply with `patch -p1` on a pristine pinned checkout; the result is
  byte-identical to the oracle tree.
- No regression test from the advisory exists at the pinned commit (`git diff pinned..fix` adds
  only `tests/sqlite/data-integrity.test.ts` cases).
- Gate: static PASSED (no leaks, no warnings; re-run after the instruction edits); nop PASSED
  (security 17, functional 59, all as expected); oracle PASSED 3/3 identical, reward 1.0;
  patches PASSED 14/14 with the declared outcome (sec_miss_base 0.6471, sec_miss_delimiter
  0.9412, sec_miss_fields 0.8235, sec_published_only 0.1176, sec_miss_import 0.8235,
  sec_miss_cleanup 0.8235, sec_miss_summary 0.8235, sec_miss_chroma 0.8824,
  sec_wrong_resource 0.8235; func_overbroad / func_refuse_all / sec_crash 0.0; hardening and
  alt_fix 1.0).

## Could not verify / caveats

- Did not run the target models (per instructions) or the Harbor gate stages beyond static here.
- The project has no lockfile, so both images resolve the same `package.json` ranges at build
  time; a large dependency drift between the two builds is possible but unlikely to matter for
  express and bun:sqlite. The verifier seeds node_modules from a pristine pinned checkout.
- The cleanup CLI and the XML import bin are developer scripts; they are real upstream code but
  not part of the worker's HTTP surface.
- The published fix itself does not satisfy the property for values containing `\x00`; the
  oracle is the published change plus the injective encoding and the other sites.
- `present_in_latest` was checked read-only at upstream HEAD d7c2da3e: the import partial key was
  later replaced by a full-field match, and the cleanup and XML-import bins were removed; the
  random migration backfill is still present.

## Out of scope (one line each)

- `plugin/scripts/worker-service.cjs` / `context-generator.cjs` contain minified copies of the old
  hash; they are build artifacts of older sources and were not used.
- `scripts/translate-readme/index.ts` uses a sha256 short prefix as a translation cache key; not
  related to memory identity.
