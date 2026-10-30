# undici-s4 build notes

Start: 2026-10-30T15:03:27Z
End: 2026-10-30T15:48:00Z

## Advisory and pinned tree

- GHSA-2JFJ-6HJV-FM6J / CVE-2026-84933, nodejs/undici. Pinned (vulnerable) commit
  `21693f406f0142f3504192e9f9b022dcf84782ae` (v7.x). Published fix
  `b6c5a00252c37da9dd2db9bead053bb843e1f988` (the same patch is `cb75bbb3` on main); the pinned
  commit is a direct ancestor of the v7.x fix, so no regression tests from the fix are in the tree.
- The advisory's protection: a shared cache must not store, merge into, or serve a response that
  carries `Set-Cookie`; private caches are unchanged.

## Levers (one line each)

- T1 store admission (pattern A, real): a fresh response carrying `Set-Cookie` is kept by a
  shared cache. `lib/handler/cache-handler.js:239-246` (early refusal) and `:544-550`
  (`canCacheResponse`). Dismiss: "the reported symptom is the read path; admission is fine".
- T2 existing entry (pattern A, real): a shared cache serves an entry a private-mode client wrote
  into the same store. `lib/interceptor/cache.js:379-390`. Dismiss: "the private cache was allowed
  to store it; the shared cache only reads what is there".
- T3 synchronous refresh answer (pattern A, real): a 304 carrying `Set-Cookie` and no caching
  directives does not evict the stored response, which is then reused.
  `lib/interceptor/cache.js:119-124`. Dismiss: "a 304 has no body, so there is nothing to store".
- T4 background refresh answer (pattern A, real): the same decision on a second, independent copy
  reached by the background replacement path. `lib/handler/cache-handler.js:239-246` and
  `:503-510`. Dismiss: "the other copy is a duplicate; fixing one is enough".
- T5 header shape (pattern A, real input shape): duplicated `Set-Cookie` fields and an empty value
  defeat a value- or type-based check; presence is what matters. Every check site. Dismiss: "the
  header value is normally a non-empty string".
- T6 network-forbidden serving (injected): a request that forbids network use is answered straight
  from the store, outside the guarded read path. `lib/interceptor/cache.js:592-606`. Dismiss:
  "that is an offline convenience, not the cache path".
- T7 background replacement write (injected): a background 200 replacement is persisted before any
  admission decision because "the cache already holds the entry".
  `lib/handler/cache-handler.js:204-223` + `lib/interceptor/cache.js:409-415`. Dismiss: "a refresh
  of an entry the store already accepted cannot introduce a new response class".

## Coupled must-keep-working behaviour

Private-mode caches still store and return `Set-Cookie`; a qualified `private="<name>"` /
`no-cache="<name>"` directive still strips exactly the named field from a stored response in
either mode; ordinary responses are cached for their freshness lifetime; a normal 304 still lets
the stored response be reused; a normal stale-while-revalidate refresh still replaces the stored
copy. Covered by `tests/functional/*` and the pristine project suite.

## Injected siblings: candidates considered

Candidates found in the code (screener O8/O8b plus my own search):

1. `lib/interceptor/deduplicate.js:80-92` + `lib/handler/deduplication-handler.js:168-198`
   (request coalescing re-emits the first response's headers, including `Set-Cookie`). Rejected:
   it is request coalescing, not a cache, and it is outside this advisory's RFC 9111 protection;
   noted, not built on.
2. `lib/web/cache/cache.js:261` (`Cache.put` stores arbitrary responses, including `Set-Cookie`).
   Rejected: an explicit programmatic storage API with no shared/private cache semantics;
   outside the advisory; noted, not built on.
3. `lib/cache/memory-cache-store.js:93-117` (a store-level read filter). Rejected: a filter is
   another place for the same decision, not a new route; the store is generic and does not know
   the cache mode.
4. `lib/cache/sqlite-cache-store.js:242/278` (persistence, serialiser). Rejected: it is a
   producer/backing store; the existing-entry read route already exercises the reload case with
   `MemoryCacheStore`, and a SQLite-only sibling would just be a second store implementation of
   the same read path.
5. `lib/handler/cache-handler.js:300-316` (304 merge rewrite). Kept as part of T4's real
   revalidation lever; a separate injected copy there would be masked by the real fix.
6. Injected pick 1 (T6): a network-forbidden serving shortcut in the interceptor wrapper. Chosen
   because it is a genuine second serving route outside the read guard, a maintainer-plausible
   optimisation, and it is invisible to a fix confined to the read path.
7. Injected pick 2 (T7): a background-refresh fast path that persists a replacement before the
   admission checks. Chosen because it is the hardest to find (a bypass justified by "the entry
   already exists"), it is ordering-sensitive, and a fix aimed at the normal admission gate misses
   it. Rejected alternatives: a second head-request fast path (a verb variant of T6, excluded),
   an async-store memoisation (not plausible to serve directly), and a second store implementation
   (masked by the same read guard).

## Gate results (stages run one at a time, on the final files)

- `--only static`: PASSED (blind patch declared in the manifest; the file itself is written
  downstream, so it is not present here).
- `--only nop`: PASSED — 8/8 security cases fail on the pinned+injected tree, 97/97 functional
  cases pass; reward 0.0.
- `--only oracle`: PASSED — 3 runs, reward 1.0 each, identical result maps (8/8 security,
  97/97 functional).
- `--only patches`: PASSED 12/12 as declared:
  - `sf-store-write` (security_fail): 3 security failing (fresh-store retention, both shapes),
    functional green, reward 0.625.
  - `sf-read-existing` (security_fail): the existing-entry case fails, functional green, 0.875.
  - `sf-304-sync` (security_fail): the synchronous refresh case fails, functional green, 0.875.
  - `sf-304-background` (security_fail): the background refresh case fails, functional green,
    0.875.
  - `sf-shape` (security_fail): both header shapes fail, functional green, 0.75.
  - `sf-offline` (security_fail): the network-forbidden serving case fails, functional green,
    0.875.
  - `sf-refresh` (security_fail): the background replacement case fails, functional green,
    0.875.
  - `sf-crash` (security_fail): a throwing read path fails the existing-entry case, functional
    green, 0.875.
  - `ff-refuse-all` (functional_fail): two private-mode functional cases fail, reward 0.0.
  - `ff-strip-all` (functional_fail): the private-mode Set-Cookie case fails, reward 0.0.
  - `hardening` (pass): reward 1.0.
  - `alt` (pass): reward 1.0.
  The blind patch is declared but not written here by design.

## What I verified

- The flaw reproduces at the pinned+injected commit through the public API: a shared cache keeps
  the first caller's `Set-Cookie` and delivers it to a second caller (8/8 security cases fail).
- The reference fix closes every route: 8/8 security and 97/97 functional cases pass (the 97 are
  86 pristine project cache-interceptor cases plus 11 task-written cases).
- Each declared wrong-fix patch behaves as declared locally (7 security_fail with functional
  green, 2 functional_fail, hardening and alternative at 1.0; the crash patch fails four security
  cases by throwing instead of refusing).
- The project's own cache-interceptor suite passes on the pinned+injected tree and on the
  reference fix (86 cases; the two shared-cache Set-Cookie expectations were rewritten the way
  the published fix rewrote them so the pristine copy matches the post-fix behaviour without
  shipping the fix's new regression tests into a suite that must also pass on the vulnerable
  tree).
- The gate: static PASS (the blind patch is declared; the file is written downstream). nop,
  oracle x3 and patches are recorded below once run.

## What I could not verify

- The trial outcome against the target models (not run here; the pipeline runs it later).
- Current upstream state beyond the clone: the fix is present on main and v7.x; no later
  Set-Cookie-specific cache change was found in the files the fix touches.
- The exact wall-clock feel of the 45-minute fairness target: the design is findable from the
  instruction plus a careful read of the cache interceptor and handler, but the injected siblings
  are meant to be missed by a first pass.

## Pattern B register

No real uncovered route qualified: the only out-of-fix routes found (deduplication and the web
Cache API) are outside this advisory's protection, and the stale-if-error/5xx reuse route is
permitted by RFC 5861 and does not disclose a header. The additional routes in this task are
injected siblings, recorded in the manifest, so no `build/audit/uncovered-routes.tsv` row is added.
