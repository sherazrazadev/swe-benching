# Build one security-fix benchmark task (build-v1)

## What this is
We build a security-fix benchmark from published, already-fixed advisories in open-source projects.
You build ONE task, from the advisory below.

The task pins the project at the commit just before the published fix and gives a solver agent that
code plus a short problem report (`instruction.md`). Hidden behavioural tests then score the
solver's fix. The tests check that the flaw is closed, using harmless inputs and markers, and that
legitimate use still works.

Everything stays on this machine. Describe each mechanism in one line in notes and reports; the
tests hold the detail, so never write exploitation steps out in prose. Stay inside this advisory's
own protection, in this repository, at the pinned commit. Note anything outside that scope in one
line in your report, and do not build on it.

Project root: `/home/mara/cwe-bench`. Task: `next.js-s4`. Pattern: `A`. Track: `injected`.

## Goal and acceptance
- **The bar.** Two target models (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) must each fail all 3
  finished attempts because of their own judgement.
- **Fairness.** Everything the tests require must be findable from `instruction.md` plus the code,
  or be standard expert knowledge. A careful engineer who knows where to look fixes it in about
  45 minutes.
- **What never counts as a failure:** timeouts, and runs cut by API or network errors.
- **Proof.** A task is built only when the gate passes. A task that misses the bar is reported as
  such, never shipped weaker.

## Inputs
- Advisory: ["GHSA-4JQV-MC3X-M676", "CVE-2026-94543"]; vercel/next.js; cache-key collision between distinct route owners (cross-route response cache poisoning, CWE-524)
- Pinned (vulnerable) commit: e92db4536a7f34ae2dbda583cfa1b4e0d06d1865. Published fix: 52c94abdd2ea5f416f5e8353ea8a2edd3fe311b8, 719e4c67d6e92df60246f95e1d96e2dd60789a52.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "8345",
 "advisory_ids": [
  "GHSA-4JQV-MC3X-M676",
  "CVE-2026-94543"
 ],
 "repo": "vercel/next.js",
 "pinned_commit": "e92db4536a7f34ae2dbda583cfa1b4e0d06d1865",
 "fix_commits": [
  "52c94abdd2ea5f416f5e8353ea8a2edd3fe311b8",
  "719e4c67d6e92df60246f95e1d96e2dd60789a52"
 ],
 "trust_decision": {
  "summary": "The cache identity of a prerendered response is decided by the source route that produced it, not by the request pathname: every non-fetch read/write of the incremental cache must be keyed and ownership-checked by (route kind, source route), so the decision lives in IncrementalCache.get/set plus every call site that must supply the owner.",
  "evidence": [
   "packages/next/src/server/lib/incremental-cache/index.ts:297-299",
   "packages/next/src/server/lib/incremental-cache/index.ts:547-552",
   "packages/next/src/server/lib/incremental-cache/index.ts:755",
   "packages/next/src/server/lib/incremental-cache/index.ts:780-783",
   "packages/next/src/server/lib/incremental-cache/file-system-cache.ts:147-150",
   "packages/next/src/server/lib/incremental-cache/shared-cache-controls.external.ts:36-67",
   "packages/next/src/build/templates/app-route.ts:163-166",
   "packages/next/src/server/route-modules/pages/pages-handler.ts:186-197",
   "packages/next/src/server/lib/incremental-cache/index.ts:700-714"
  ]
 },
 "landing_point": {
  "where": "packages/next/src/server/lib/incremental-cache/index.ts:547",
  "why": "The request pathname becomes the storage key here (`_getPathname` -> normalizePagePath) and is handed straight to the cache handler, so anyone reading only the SSG/ISR cache-poisoning summary looks first at this key derivation."
 },
 "fix_sites": [
  {
   "where": "fix.diff:1934-2047",
   "entry_point": "internal module used by every response cache read/write (new file at packages/next/src/server/lib/route-cache-key.ts)",
   "module_kind": "new server library (key/owner primitive)"
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/index.ts:479-552",
   "entry_point": "all SSG/ISR/RSC responses through IncrementalCache.get",
   "module_kind": "cache storage layer"
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/index.ts:719-787",
   "entry_point": "all SSG/ISR/RSC responses through IncrementalCache.set",
   "module_kind": "cache storage layer"
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/file-system-cache.ts:105-346",
   "entry_point": "built-in filesystem cache handler (server/app, server/pages)",
   "module_kind": "cache storage backend / save-reload"
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/shared-cache-controls.external.ts:36-85",
   "entry_point": "revalidate/expire lifetimes read per response",
   "module_kind": "defaults/merge route"
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/memory-cache.external.ts:25-62",
   "entry_point": "LRU memory cache used by the filesystem handler",
   "module_kind": "second cache implementation"
  },
  {
   "where": "packages/next/src/server/lib/node-fs-methods.ts:1-12",
   "entry_point": "built-in CacheFs used by the filesystem handler",
   "module_kind": "storage primitive"
  },
  {
   "where": "packages/next/src/server/response-cache/index.ts:318-530",
   "entry_point": "ResponseCache.get/set/revalidate for Pages, App Page and App Route",
   "module_kind": "request-time response cache"
  },
  {
   "where": "packages/next/src/server/response-cache/types.ts:222-260",
   "entry_point": "cache handler context types (public cache handler contract)",
   "module_kind": "public API contract"
  },
  {
   "where": "packages/next/src/server/route-modules/route-module.ts:107-140",
   "entry_point": "every route module's handleResponse",
   "module_kind": "route module base"
  },
  {
   "where": "packages/next/src/server/route-modules/pages/pages-handler.ts:185-218",
   "entry_point": "GET/HEAD to a Pages Router SSG/ISR page",
   "module_kind": "route module handler"
  },
  {
   "where": "packages/next/src/build/templates/app-route.ts:163-198",
   "entry_point": "HTTP request to an App Router route.ts handler",
   "module_kind": "generated runtime template"
  },
  {
   "where": "packages/next/src/build/templates/app-page-runtime.ts:278-290",
   "entry_point": "HTTP request to an App Router page (HTML/RSC/prefetch/PPR)",
   "module_kind": "generated runtime template"
  },
  {
   "where": "packages/next/src/export/worker.ts:233-236",
   "entry_point": "next build prerender / exportPage",
   "module_kind": "build-time artifact writer"
  },
  {
   "where": "packages/next/src/export/routes/app-page.ts:218-229",
   "entry_point": "next build writes the App Page .meta next to HTML",
   "module_kind": "serializer"
  },
  {
   "where": "packages/next/src/export/routes/types.ts:4-10",
   "entry_point": "RouteMetadata produced at build, read at runtime",
   "module_kind": "serialization schema"
  },
  {
   "where": "packages/next/src/export/routes/pages.ts:29-60",
   "entry_point": "next build writes Pages HTML/JSON",
   "module_kind": "build-time artifact writer"
  },
  {
   "where": "packages/next/src/build/index.ts:3881-3900",
   "entry_point": "next build output layout (_not-found.html move)",
   "module_kind": "build step"
  },
  {
   "where": "packages/next/src/build/adapter/build-complete.ts:1092-1110",
   "entry_point": "next build with experimental.adapterPath",
   "module_kind": "build adapter packaging"
  },
  {
   "where": "packages/next/src/build/collect-build-traces.ts:478-492",
   "entry_point": "standalone packaging file trace",
   "module_kind": "build packaging"
  },
  {
   "where": "packages/next/src/server/next-server.ts:84-92",
   "entry_point": "node server render pipeline",
   "module_kind": "server entry"
  },
  {
   "where": "packages/next/src/server/base-server.ts:2649-2653",
   "entry_point": "App page selection by pathname",
   "module_kind": "server entry"
  },
  {
   "where": "packages/next/src/server/route-matcher-providers/app-page-route-matcher-provider.ts:22-59",
   "entry_point": "route matching for App pages (appPaths per pathname)",
   "module_kind": "matcher provider"
  },
  {
   "where": "packages/next/src/server/image-optimizer.ts:706-716",
   "entry_point": "/_next/image with a custom cache handler",
   "module_kind": "second cache consumer"
  },
  {
   "where": "packages/next/src/shared/lib/router/utils/app-paths.ts:30-52",
   "entry_point": "app path normalisation shared by build and runtime",
   "module_kind": "shared util"
  },
  {
   "where": "packages/next/src/shared/lib/utils.ts:462-469",
   "entry_point": "CacheFs interface",
   "module_kind": "storage interface"
  },
  {
   "where": "packages/next/taskfile.js:1896-1905",
   "entry_point": "build of next/dist/compiled/hash.js",
   "module_kind": "vendored dependency build"
  },
  {
   "where": "packages/next/package.json:1-40",
   "entry_point": "package exports for the new module",
   "module_kind": "package metadata"
  }
 ],
 "O1_entry_points": 5,
 "O2_out_of_scope_site": {
  "kind": "save_reload_or_serialization",
  "where": "packages/next/src/export/worker.ts:233-236"
 },
 "O3_reason_to_dismiss": "A build-time prerender artifact is written to a pathname-derived file path and only read back later by the runtime cache, so a solver can argue that build output is a packaging concern separate from a request-time cache lookup.",
 "O4_distance": {
  "files": 30,
  "packages": 1,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "The data cache (`fetch` and `use cache`/unstable_cache) is intentionally shared across routes by URL, and `output: 'export'` must keep emitting public path-addressable files; an over-broad fix that scopes every incremental-cache write by route owner, or that rewrites exported public paths, breaks that sharing.",
  "where": "packages/next/src/server/web/spec-extension/unstable-cache.ts:228-242"
 },
 "O6_input_shapes": [
  "pathname aliases: '/index' vs '/', trailing slash on/off, locale-prefixed '/en/x'",
  "percent-encoded aliases of the same pathname: %2F, %24, %25, %5F, plus Unicode and space parameters",
  "owner identity variants: Pages definition.pathname vs a Turbopack module name with a trailing /index; App definition.page including route groups (group) and parallel slots @slot",
  "prerender metadata variants: srcRoute null, fallbackSourceRoute set, dataRoute null / .json / .rsc",
  "fallback shell vs concrete entry (isFallback true/false) and PPR partial shells (postponed present/absent)",
  "deployment variants: no adapter (historical server/pages and server/app seeds) vs experimental.adapterPath (scoped build artifacts) vs output: 'export' (public files)",
  "encoded slash and the '$' separator inside the request pathname"
 ],
 "O7_producer": {
  "kind": "serializer",
  "where": "packages/next/src/export/routes/app-page.ts:218-229",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "packages/next/src/server/image-optimizer.ts:605-611",
   "sibling": "a second direct cacheHandler consumer keyed by its own pathname-derived key (image, and any future font/OG optimiser)",
   "why_realistic": "The image optimiser already bypasses IncrementalCache and calls cacheHandler.get/set directly, so a maintainer adding another optimiser-style cache would copy that shape."
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/shared-cache-controls.external.ts:40",
   "sibling": "another manifest-keyed defaults map (e.g. expire or rendering-mode metadata) looked up by pathname",
   "why_realistic": "The class is a copy-on-write map keyed by route with a prerender-manifest fallback; adding one more per-route default follows the same pattern."
  },
  {
   "where": "packages/next/src/export/worker.ts:233",
   "sibling": "another build-time artifact writer (route handler .body, segment prefetch payloads) that derives its file path from the request pathname",
   "why_realistic": "The build worker already writes HTML/JSON/body/meta next to each other from one pathname-derived path."
  },
  {
   "where": "packages/next/src/server/lib/incremental-cache/index.ts:552",
   "sibling": "a new response kind (metadata routes such as sitemap.ts / opengraph-image) reusing the same funnel with a pathname key",
   "why_realistic": "Metadata routes are prerendered through the same incremental cache and would naturally be added as one more IncrementalCacheKind."
  },
  {
   "where": "packages/next/src/server/web/spec-extension/unstable-cache.ts:235",
   "sibling": "a `use cache`/data-cache entry that starts carrying route-owner state",
   "why_realistic": "It already shares one cache with the response cache through the FETCH kind, so a maintainer extending cache isolation would touch it next."
  }
 ],
 "O9_family": "cache-key collision between distinct route owners (cross-route response cache poisoning, CWE-524)",
 "O9_dos": false,
 "O10_build": {
  "language": "TypeScript (Node.js server); a Rust workspace is present for Turbopack but is not needed for this code path",
  "toolchain": "pnpm workspaces + turbo; Node >= 20.9.0; jest/playwright harness (scripts/run-jest.sh --mode=start)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "Existing at the pinned commit: test/e2e/prerender.test.ts, test/integration/prerender-revalidate/test/index.test.js, test/integration/preview-fallback, test/production/adapter-config*. The fix adds test/production/app-dir/route-scoped-cache*, test/production/route-scoped-cache-export, test/unit/route-cache-key and test/unit/incremental-cache/*, which are not present at the pin."
 },
 "O11_fix_minutes": 180,
 "O12_red_flags": [],
 "O13_recall_risk": "high",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "packages/next/src/server/lib/route-cache-key.ts (new), server/lib/incremental-cache/index.ts, server/lib/incremental-cache/file-system-cache.ts, server/lib/incremental-cache/shared-cache-controls.external.ts, server/lib/incremental-cache/memory-cache.external.ts, server/lib/node-fs-methods.ts, server/response-cache/index.ts, server/response-cache/types.ts, server/route-modules/route-module.ts, server/route-modules/pages/pages-handler.ts, server/route-matcher-providers/app-page-route-matcher-provider.ts, server/base-server.ts, server/next-server.ts, server/image-optimizer.ts, build/index.ts, build/adapter/build-complete.ts, build/collect-build-traces.ts, build/templates/app-page.ts, build/templates/app-page-runtime.ts, build/templates/app-route.ts, export/worker.ts, export/types.ts, export/routes/app-page.ts, export/routes/app-route.ts, export/routes/pages.ts, export/routes/types.ts, shared/lib/router/utils/app-paths.ts, shared/lib/utils.ts, packages/next/src/compiled/hash.js/sha256/*, packages/next/taskfile.js, packages/next/package.json, packages/next/types/$$compiled.internal.d.ts",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Namespace the response cache key by the resolved route pattern at the Pages request handler only (or add a pathname re-match guard that 500s/404s colliding requests), leaving App pages, route handlers, build seeds, cache-control defaults and the custom-handler key contract keyed by pathname."
 },
 "out_of_scope_notes": [],
 "unverified": [
  "repo_mb: the checkout could not be sized without a shell; it contains a full Turbopack Rust workspace so the 5 MB tiny-repo threshold clearly does not apply, but the 1.5 GB giant-repo threshold could not be measured.",
  "The advisory text itself (GHSA-4JQV-MC3X-M676 / CVE-2026-94543) was not available offline; the mechanism was reconstructed from the published fix, its tests and the pinned code.",
  "O8 is empty after inspecting every non-fetch incremental-cache read/write and direct cacheHandler caller at the pinned commit; a route behind a subsystem I did not open (e.g. a deploy-mode adapter branch) could still exist.",
  "j_sibling_sites is 'no' rather than 'unknown' only on the strength of that search.",
  "Line numbers taken from fix.diff hunk headers drift from this checkout for several files (e.g. build/adapter/build-complete.ts), so fix_sites cite pinned lines I re-read, or fix.diff lines where the site does not exist at the pin.",
  "O11 (180 min) is for threading an owner through all changed source files; a minimal runtime-only isolation fix is roughly 45-90 min, and that is what hidden behavioural tests would most likely reward."
 ]
}
  ```
- Published fix sites:   - fix.diff:1934-2047 — entry point: internal module used by every response cache read/write (new file at packages/next/src/server/lib/route-cache-key.ts) [new server library (key/owner primitive)]
  - packages/next/src/server/lib/incremental-cache/index.ts:479-552 — entry point: all SSG/ISR/RSC responses through IncrementalCache.get [cache storage layer]
  - packages/next/src/server/lib/incremental-cache/index.ts:719-787 — entry point: all SSG/ISR/RSC responses through IncrementalCache.set [cache storage layer]
  - packages/next/src/server/lib/incremental-cache/file-system-cache.ts:105-346 — entry point: built-in filesystem cache handler (server/app, server/pages) [cache storage backend / save-reload]
  - packages/next/src/server/lib/incremental-cache/shared-cache-controls.external.ts:36-85 — entry point: revalidate/expire lifetimes read per response [defaults/merge route]
  - packages/next/src/server/lib/incremental-cache/memory-cache.external.ts:25-62 — entry point: LRU memory cache used by the filesystem handler [second cache implementation]
  - packages/next/src/server/lib/node-fs-methods.ts:1-12 — entry point: built-in CacheFs used by the filesystem handler [storage primitive]
  - packages/next/src/server/response-cache/index.ts:318-530 — entry point: ResponseCache.get/set/revalidate for Pages, App Page and App Route [request-time response cache]
  - packages/next/src/server/response-cache/types.ts:222-260 — entry point: cache handler context types (public cache handler contract) [public API contract]
  - packages/next/src/server/route-modules/route-module.ts:107-140 — entry point: every route module's handleResponse [route module base]
  - packages/next/src/server/route-modules/pages/pages-handler.ts:185-218 — entry point: GET/HEAD to a Pages Router SSG/ISR page [route module handler]
  - packages/next/src/build/templates/app-route.ts:163-198 — entry point: HTTP request to an App Router route.ts handler [generated runtime template]
  - packages/next/src/build/templates/app-page-runtime.ts:278-290 — entry point: HTTP request to an App Router page (HTML/RSC/prefetch/PPR) [generated runtime template]
  - packages/next/src/export/worker.ts:233-236 — entry point: next build prerender / exportPage [build-time artifact writer]
  - packages/next/src/export/routes/app-page.ts:218-229 — entry point: next build writes the App Page .meta next to HTML [serializer]
  - packages/next/src/export/routes/types.ts:4-10 — entry point: RouteMetadata produced at build, read at runtime [serialization schema]
  - packages/next/src/export/routes/pages.ts:29-60 — entry point: next build writes Pages HTML/JSON [build-time artifact writer]
  - packages/next/src/build/index.ts:3881-3900 — entry point: next build output layout (_not-found.html move) [build step]
  - packages/next/src/build/adapter/build-complete.ts:1092-1110 — entry point: next build with experimental.adapterPath [build adapter packaging]
  - packages/next/src/build/collect-build-traces.ts:478-492 — entry point: standalone packaging file trace [build packaging]
  - packages/next/src/server/next-server.ts:84-92 — entry point: node server render pipeline [server entry]
  - packages/next/src/server/base-server.ts:2649-2653 — entry point: App page selection by pathname [server entry]
  - packages/next/src/server/route-matcher-providers/app-page-route-matcher-provider.ts:22-59 — entry point: route matching for App pages (appPaths per pathname) [matcher provider]
  - packages/next/src/server/image-optimizer.ts:706-716 — entry point: /_next/image with a custom cache handler [second cache consumer]
  - packages/next/src/shared/lib/router/utils/app-paths.ts:30-52 — entry point: app path normalisation shared by build and runtime [shared util]
  - packages/next/src/shared/lib/utils.ts:462-469 — entry point: CacheFs interface [storage interface]
  - packages/next/taskfile.js:1896-1905 — entry point: build of next/dist/compiled/hash.js [vendored dependency build]
  - packages/next/package.json:1-40 — entry point: package exports for the new module [package metadata]
- Uncovered routes to confirm (pattern B): none
- Design plan from the lead: No lead plan is provided for this task — you are the lead as well as the builder. Using the Design section above and the screener record, design the task yourself and WRITE YOUR PLAN in `notes.md` BEFORE you build:
  - choose the main lever and at least one more, each with a DIFFERENT reason a solver would dismiss or skip it. The main lever must be HOW-type (its fix needs the mechanism understood: a producer the check never calls, a coupled must-keep-working value, a shape a plausible check mishandles, a route where the protection never existed); another entry point or a planted copy is only an extra;
  - decide the sites, routes and input shapes the security tests will cover;
  - identify the coupled must-keep-working behaviour next to each lever, for the functional tests;
  - for the injected track: decide the realistic sibling gap(s) to add — each must be code a maintainer could plausibly have left, reachable through the real entry point, covered by the task's one general property (never by a sentence of its own), and placed where the published fix never touches. First list EVERY possible sibling site and route you can find (the screener's O8/O8b leads plus your own search of the code). Then pick 2–4 of them: the most complex and hardest to find of all the candidates (how-type over where-type, far from where the report leads, with a plausible reason to dismiss), each with a different reason a solver would skip it. Record the full candidate list, and why each pick beat the others, in notes.md;
  - write the security property ONCE, in general terms over the protected data or outcome, before choosing routes. Every route and sibling must fall under it as written; the report must not describe where any of them lives;
  - if this candidate cannot support a fair task that meets the bar (flaw does not reproduce at the pinned commit through a real entry point, needs network/GPU/GUI at run time, or no design meets the bar), STOP and report why. Do not ship a weak task.
Follow every rule in the Design, Report, Tests and Proof sections exactly. You choose the design; the rules are fixed.
- Host notes: none

## Design: where difficulty comes from
Models find the code the report leads to and diagnose it correctly. They fail on scope. Build these
in, in order of evidence:
1. **Pattern A: the published fix's far sites.**
   - The report leads to one site. The tests cover every entry point the published fix protects,
     including one in a module that looks out of scope: a second implementation, a lower-level
     public API, a wrapper, a save/reload path, or a defaults or merge route.
   - Give it a plausible **reason to dismiss**, and **distance**: another file or package from the
     landing point.
   - **A second implementation is the strongest form of this**: separate code doing the same
     guarded operation (a fallback backend, another package, another transport, a legacy version),
     so fixing the reported copy changes nothing in the other. Models fix the copy the example hits,
     re-run the example and stop. Prefer a real one (Pattern A or B) over a planted one. Find
     candidates by searching for the low-level primitive across packages (redirect following,
     header copying, file writes, message construction). It only counts if the report never
     describes it.
2. **Pattern B: uncovered routes.**
   - Routes into the same protected sink where the advisory's own protection is missing at the
     pinned commit, and which the published fix did not touch.
   - They are unmodified upstream code. A solver may argue they were never covered, but the task's
     general property covers them, so leaving one open is a model failure, not out of scope. The
     same holds for a route where the protection never existed: the property requires it.
   - Make sure the property, read literally, really covers each route (no word that excludes it),
     and that its test fails only when the protection is really missing (it must pass a correct
     fix placed at any valid layer).
   - The strongest lever found so far: DeepSeek 6 of 6 on one; both models 0 of 3 on three combined.
3. **Shape traps: an input form that a plausible check mishandles.** Examples: a value given as an
   array where the check only handles a string; a name split on the first separator when it can
   contain the separator; a resolved path against a lexical check; a rename or rewrite that happens
   after the check; a nested expression the check never inspects. Two conditions: the general
   property must cover the form literally, and the form must not fall inside anything a
   must-keep-working clause or a test fixture calls legitimate. A pure spelling, encoding, verb,
   protocol or role variant of a stated input is NOT a shape trap: both models always catch those
   (see "Never add").
4. **A coupled must-keep-working behaviour** next to the sink, tested functionally, so an
   over-broad fix fails. MiMo tends to over-harden.
5. **Producer off the check's path.** The check depends on data produced elsewhere (a schema,
   serializer, cache, mapper, table builder or config loader) and does not call it; the data
   reaches the check on a separate path (saved and reloaded, rebuilt from config). The fix needs
   both the check and the producer. Models trace into what the check calls, never back to where
   its data comes from. Rules:
   - it counts only if the producer is infrastructure, not a request handler;
   - verify that the check does **not** call the producer; if it does, the model follows the call
     and fixes it;
   - the report describes impact only through the check's path and states the property abstractly
     ("including data saved earlier"); it never points at the producer or the reload path;
   - avoid fixes where the check cannot compile without the producer change (that forces the find);
   - hidden tests must not need a field or function name the solver would have to guess;
   - prefer a producer deep in internal machinery (a table or schema builder). One behind a path
     that is easy to follow falls as soon as anything points at it.
6. **Injected siblings**, only where the plan asks for them. Each must be:
   - code a maintainer could have written, with no deceptive names or comments;
   - reachable through the real entry point;
   - covered by the task's general property, never by a sentence of its own;
   - placed where the upstream fix never touches.
7. **Wrong object.** The authorization check exists but decides on a different object than the one
   the request actually touches: a neighbouring or proxy resource (a parent or container instead of
   the item written), or an identity field the caller supplies (an account inside a caller-provided
   resource name; a parent read from one part of the request while the write uses another). Models
   copy the nearby precedent. Rules:
   - the instruction names the protected object class in product terms ("the objects that hold the
     limits"), never the check or its location;
   - the security test denies exactly the object touched while the proxy object stays allowed;
   - a functional test keeps a legitimate request on that same object working.
8. **Ordering.** The check is right but runs at the wrong moment: after an adjustment turns the
   attacker's value into a different bad value (an offset, a clamp, a unit conversion, a
   normalisation), or after a side effect has already happened (a directory created, a file cleared,
   copied or re-permissioned, a request sent) before the refusal. Rules:
   - the instruction states the property over the attacker's input or the outcome ("nothing outside
     the folder is created or changed, even when the request is refused"), never the order of steps;
   - the security test checks the side effect itself, not only the response;
   - any fix that keeps the property passes, wherever it places the check.
9. **Route where the protection never existed.** Real code reaches the protected sink but never had
   the check at all, so its absence reads as design (DeepSeek missed one 6 of 6 times). Rules:
   - it needs a plausible reason to dismiss: an unsupported combination, a legacy path, a
     neighbouring feature. If the project documents the protection as applying everywhere with no
     exceptions, there is no reason to dismiss and the route adds nothing;
   - the general property must cover it literally; never describe it in the instruction;
   - confirm it with a behavioural test on the pinned copy, like any Pattern B route.
10. **Merged or defaults route.** The restricted value reaches the sink through defaults, a merge,
    inheritance, a patch, or stored configuration rather than the request field the report shows.
    Models treat the report's example fields as the whole set. Rules:
    - state the property over the sink ("anything a submitter supplies that ends up in X, however
      it gets there"), not over the entry or field;
    - the security test drives the merged or stored route through the real entry point;
    - a functional test keeps legitimate defaults and merges working.

Aim for at least two levers with **different** reasons to dismiss.

**At least one lever must be how-type**: its fix needs the mechanism understood, not only found.
How-type levers are a producer off the check's path (5), a coupled must-keep-working value (4), a
shape that a plausible check mishandles (3: a separator split, a rename after the check), and a
route where the protection never existed. Where-type levers (another entry point into the same code,
a second copy, injected siblings) only cost a search. They held only when the report stayed general,
so count them as extras, never as the task's main difficulty.

Never add:
- encoding, verb, protocol or role/direction variants;
- more routes of one concept;
- resource-exhaustion traps.

Every lever must be findable by a blind engineer from the report and the code. A lever that a blind
fix cannot find is unfair: remove it.

**Pattern B rules:**
- Confirm each route with a behavioural test on the pinned copy before relying on it. The
  screener's claim is only a lead.
- Append one row per route to `/home/mara/cwe-bench/build/audit/uncovered-routes.tsv`, using its existing
  header. Columns:
  - `task`, `repo`, `advisory`;
  - `trap_ref` (the manifest trap id only; no mechanism text, since the manifest holds the detail);
  - `real_upstream`;
  - `present_in_latest` (`yes`, `no` or `unknown`, from a read-only look at current upstream code if
    you can reach it);
  - `public_upstream_report`, `in_current_scope`, `built`, `note`;
  - `disclosure_status` (`pending client decision`).

## Environment (`tasks/next.js-s4/environment/Dockerfile`)
- **Base and code.** A small official base image. The repo goes into `/app` at the pinned commit,
  and `/app/.git` is then deleted.
- **Offline.** Install every dependency, tool and service the project and tests need; nothing may
  be downloaded at test time. Services start from `test.sh`.
- **Packages:** `patch`, `curl`, `ca-certificates`, `bash`, `git`.
- **Agent layer.** Append `common/trial/claude-code.Dockerfile.snippet` unchanged at the end.
- **No test code in the image.** The agent shares the container. Pre-build against stubs; `test.sh`
  copies the real tests in at grading time.
- **Project tests.** The project's own tests for the affected area must pass in the image at the
  pinned commit.
- **No leaked regression tests.** The pinned commit must not already contain the advisory's
  regression tests (check `git log` between the pinned and fix commits).

## Report to the solver (`tasks/next.js-s4/instruction.md`)
**Write:**
- what the system is, at product level;
- one observed impact, with ONE concrete trigger at user level (HTTP request, CLI call or public API
  use);
- the security property as an **invariant**, stated once in general terms: who may do what to which
  data, or what attacker input must never achieve ("no value of X may …, however it arrives"). It is
  fair when, read literally, it covers every tested route and shape; it must not point at any of
  them. Write a second property only for a genuinely different protection, never one per route,
  and never a count;
- every **contract** the tests need, each stated once for the whole product, never per route:
  - the refusal form ("a client error with no side effect");
  - any interface or field name a test uses, stated so it applies everywhere. If a sibling's test
    would need a contract that only that sibling uses, change the test so it does not, or drop the
    sibling;
  - preservation clauses ("everything that works today keeps working exactly as today"). Name a
    coupled legitimate value in property terms ("visible values keep binding even next to a hidden
    one"), not by the feature or route it sits on;
  - a legitimate magnitude next to any attack magnitude;
- that examples are examples, not the full set;
- the standard constraints block: fix the problem and its close variants; keep legitimate use
  working; do not look up the upstream fix; do not special-case the
  example.

**Never write:**
- file, package, function, class, field or parameter names a user would not see;
- line numbers, the root cause, the fix approach, or a CVE or GHSA id;
- a list of routes, spellings or roles;
- restricting adverbs ("directly", "only via");
- anything that names or paraphrases a far site, an uncovered route or an injected sibling;
- any clause that describes where a far site, uncovered route or injected sibling lives, even in
  product terms: no route, operation, command, channel, object kind, stage or format that points
  at one of them. State each property once, over the protected data or outcome, so it covers every
  route without pointing at any;
- a word that is general but is also the name of one stage or entry point ("loading" when the
  product has a load call). Pick wording that cannot be read as one surface.

Check before you finish: for each sentence of the report, ask whether it exists to cover one
specific route or trap. If it does, delete it or widen it into the general property.

Put every identifier that must not appear in `manifest.leak_terms`.

## Tests (`tasks/next.js-s4/tests/`)
- **`security/`:** one test per site, route, input shape and form. Each one:
  - goes through the real entry point;
  - fails on the pinned code and passes on a correct fix;
  - asserts the attack is blocked: any client error plus no side effect, never one exact status.
- **`functional/`:**
  - legitimate use, including the coupled behaviour of every lever;
  - where they exist, the project's own tests for the area.
- **No product code in a test's bookkeeping.** Compute expected values and clean-ups in the test
  itself, because a hardened helper must not crash a test.
- **Stubs** of permission or authority answer per resource and verb, like the real thing.
- **Scope.** A test may vary only what the instruction names, and drive only the entry point it
  names.
- **No network**, and nothing that depends on the fix commit being present.
- **Templates.** JUnit XML into the two directories the template names. Copy `score.py` unchanged.
  Edit only the marked command lines of `test.sh`, and keep its agent-kill block.

## Proof
- **The oracle.** `solution/fix.patch` is the published fix reduced to source changes, plus fixes
  for every uncovered route and injected sibling in the task. `solution/solve.sh` applies it to
  `/app`.
- **Wrong-fix patches** go in `build/next.js-s4/checks/`, listed in `manifest.patch_checks`:
  - one `security_fail` per lever (the fix that misses only that lever);
  - a `functional_fail` (an over-broad or feature-removing fix);
  - a `pass` of kind `hardening` (the oracle plus defensive hardening of the product code the
    security tests import);
  - a `pass` alternative fix where a second valid design is plausible.
- **`manifest.wrong_fix_catalogue`:** for each class, a `checks/` patch, or `n/a: <why>`:
  `refuse_all`, `crash_as_refusal`, `wrong_resource`, `one_role_or_direction`, `reads_only`,
  `check_after_adjustment`, `unlisted_route`, `malformed_identity`, `missing_authority`,
  `adjacent_api`.

## Deliverables
**`tasks/next.js-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/next.js-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `A`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/next.js-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py next.js-s4 --only static
python3 -I common/gate/gate.py next.js-s4 --only nop
python3 -I common/gate/gate.py next.js-s4 --only oracle
python3 -I common/gate/gate.py next.js-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/next.js-s4/`;
  - edit only `tasks/next.js-s4/`, `build/next.js-s4/` and, for pattern B, the register;
  - do not commit.

## Stop and report instead of shipping when
- the flaw does not reproduce through a real entry point at the pinned commit;
- a planned route or site is not reachable, or the check calls the producer directly (substitute
  another lever the code supports if you can, and say so);
- the task needs network at run time, or a GPU, kernel or GUI;
- the tests are flaky;
- no design meets the bar.

## Report back (under 400 words)
- The gate result for each stage.
- Each lever in one line: pattern, shape, file:line, reason to dismiss.
- Pattern B: each register row.
- The instruction's word count.
- Every guess you could not verify.
- Any fairness concern you see yourself.
- Anything noticed outside the scope, in one line.
- If abandoned, exactly why.
