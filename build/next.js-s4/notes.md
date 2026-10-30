# next.js-s4 — build notes

Started: 2026-10-30T15:03:21Z
Ended: 2026-10-30T17:35:00Z

## Inputs verified

- Advisory lead (GHSA-4JQV-MC3X-M676 / CVE-2026-94543, vercel/next.js, cache-key collision between
  distinct route owners, CWE-524) against the real repository.
- Pinned commit `e92db4536a7f34ae2dbda583cfa1b4e0d06d1865` is the direct parent of the published fix
  `719e4c67d6e92df60246f95e1d96e2dd60789a52`; `52c94abd...` is the same change rebased on the
  lts-maintenance branch. The fix diff applies cleanly to the pin.
- The pinned tree contains no `test/production/app-dir/route-scoped-cache` regression suite (the
  published fix adds it). Only source changes from the fix are used in `solution/fix.patch`
  (33 published source files; the published unit tests under `packages/next/src` are not included).

## Task shape

Pattern A, injected track. One framework (Next.js), one protected outcome: a response produced by
one page/route handler must never be served, observed or overwritten for another route that
accepts a different request URL for the same decoded path.

Reproduced through a real `next build` + `next start` fixture: a Pages catch-all page and an ISR
page that owns `/victim/known`. At the pin, `/%76ictim/known` serves the owning page's prerendered
body, the catch-all's runtime write supplies the owning page's later response, a sibling's
not-found entry denies the catch-all, and cross-kind requests return 500.

## Levers (one line each)

1. **Real, how-type — build seeds.** Prerendered artifacts produced at build are read back by the
   check from a path derived only from the request pathname; ownership has to be checked against
   the metadata saved with the seed. File-system cache read path in the pinned
   `server/lib/incremental-cache/file-system-cache.ts`. Reason to dismiss: build output is
   immutable public material, not the runtime cache the report shows. Patch:
   `seed_admission_unchecked.patch`.
2. **Real — negative outcomes and admission.** A sibling's `notFoundRoutes` entry and prerender
   admission are consulted for every owner. Reason to dismiss: a 404 is not a body. Patch:
   `negative_entry_unscoped.patch`.
3. **Real, second implementation — the App Router module graph.** Pages responses and App Router
   page/route-handler responses reach the same storage through different generated runtimes; a fix
   placed only at the reported Pages path leaves App owners sharing the pathname. Reason to
   dismiss: the two routers already use different output directories. Patch:
   `only_pages_scoped.patch`.
4. **Injected — in-memory alias.** The process memory cache folds entries onto the request path so
   HTML/data variants share one copy; under a correct scoped key it still reintroduces the
   collision. Reason to dismiss: "the memory cache only stores the storage key it is given".
   Patch: `memory_alias_unfixed.patch`.
5. **Injected — persisted compatibility copy.** `MultiFileWriter` mirrors response payloads to the
   historical location (metadata stays scoped), and a sibling's verified build seed is then read
   from that location. Reason to dismiss: "the writer only writes files it is handed". Patch:
   `persisted_copy_unfixed.patch`.

Coupled must-keep-working: prerendered pages, ISR hits, per-page revalidation, HTML/data agreement,
the deliberately shared fetch/data cache (`data-a`/`data-b` fetch the same URL and must see one
value), a configured cache handler, and `/_next/image`.

## Sibling candidates considered

From the screener O8b plus a search of the pinned tree:

- image optimizer (`server/image-optimizer.ts`) — real second handler consumer, but the published
  fix touches it, so it cannot be an injected sibling; it is used as coupled functional coverage
  instead.
- `shared-cache-controls.external.ts`, `export/worker.ts`, `incremental-cache/index.ts`,
  `file-system-cache.ts` — touched by the published fix; used as far sites/levers, not injections.
- `server/lib/incremental-cache/memory-cache.external.ts` — untouched shared module on the response
  path; chosen (T4).
- `lib/multi-file-writer.ts` — untouched shared module used by every response write; chosen (T5).
- `server/response-cache/web.ts` — a second ResponseCache implementation, but it is dead code in
  this version (not imported anywhere); rejected.
- `server/og/cache-image-response.ts` — a per-prerender resume-data cache, not shared across
  routes; rejected.
- `server/lib/incremental-cache/tags-manifest.external.ts`, `server/lib/cache-handlers/default.ts`
  — data/`use cache` and tag state; either intentionally shared or not on the response sink;
  rejected.
- `server/route-modules/app-route/module.ts` — module state is instantiated per route bundle, so a
  per-module memo cannot collide across routes (verified experimentally); rejected.

Picked T4 and T5 because both are shared layers reached by every response, both are plausible
maintainer additions, and their reasons to skip differ (performance layer vs. file writer). T4 was
validated by disabling every other sibling; T5 likewise.

## Verification performed

- Local harness against the pinned+injected tree: security 0/11 pass, functional 10/10 pass.
- Local harness against `solution/fix.patch` applied to the pinned+injected tree: 11/11 and 10/10.
- Every `checks/*.patch` was applied to a fresh pinned+injected tree, the framework rebuilt, and
  both suites run; each behaved as declared (see the manifest). `alt_correct_fix.patch` (a literal,
  non-hashed owner namespace) and `hardened_fix.patch` both score 1.0.
- `patch -p1` application of `injection.patch` then `solution/fix.patch` reproduces the oracle tree
  byte-for-byte for the touched source files.
- Project tests in the environment image: `taskr precompile compile` and
  `jest test/unit/incremental-cache` (18 tests) on the pinned+injected tree, green.

## Gate results (all stages run individually, in order)

- `static`: passes every check except the intentionally missing `blind` patch (written by the
  pipeline later). No instruction leaks, no test leaks into the image, delivery format conforming.
- `nop`: PASSED — vulnerable+injected code fails all 11 security tests and passes all 10
  functional tests (trial `next.js-s4-nop-1793379385`).
- `oracle`: PASSED — three trials, identical results, reward 1.0 (trials
  `next.js-s4-oracle{1,2,3}-1793379633/635/940`).
- `patches`: PASSED — all nine `checks/*.patch` behave as declared: the two `pass` patches score
  1.0; `seed_admission_unchecked`, `negative_entry_unscoped`, `only_pages_scoped`,
  `memory_alias_unfixed`, `persisted_copy_unfixed` and `deny_collision_requests` each leave at
  least one security test failing with every functional test passing; `functional_overbroad`
  breaks three functional tests.
- A full end-to-end verifier run was also reproduced outside Harbor against the oracle sources
  (reward 1.0, 21/21).

## Could not verify / unknowns

- The blind fix and the target-model trials are written/run by the pipeline; this build makes no
  claim about the bar until those trials exist.
- The published fix's original line numbers drift from this checkout for several files; the trap
  `where` fields cite pinned lines re-read in this checkout or pinned file/function regions.
- The upstream fix also changes build adapters, standalone tracing and `output: 'export'`
  behaviour; those are outside this task's tested protection and are not needed for the tests.
- Whether a target model fails every attempt is only known after trials; this build makes no claim
  about that.

## Fairness notes

- All tested mechanisms are reachable from `instruction.md` plus the code: the property is stated
  over outcomes and over "responses produced before the server started", and the contracts name
  the data cache, custom handler and image optimization.
- The two injected siblings are visible product code with plain names and no comments pointing at
  them.
- A correct fix at a different layer passes: the alternative fix changes the key encoding, and the
  hardening patch adds a stricter check; both score 1.0.
- The custom-handler contract ("one key per owner") is stated in the instruction so a behaviour-only
  fix that reuses one handler key is not unfairly failed.
