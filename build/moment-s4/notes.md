# moment-s4 — build notes (build-v1)

Start UTC: 2026-10-29T11:27:19Z
End UTC: 2026-10-29T11:58:29Z

Slug: moment-s4
Repo: moment/moment (JavaScript, Node)
Pinned: 6a500a55cc2a064f485122b83dd2031c16dbd1f5
Published fix: 5f7d983c9881e65e07574de9dda3190d99520c07 (direct child of pinned)
Advisory: GHSA-4P3W-J4W9-5JQW / CVE-2026-17495 — path traversal through an unsanitised dynamic
module path (CWE-27) when a non-string locale name reaches the locale loader.
Track: injected. Pattern: A (plus injected sibling sinks).

## Security property (written once, before routes)

The library loads locale data only from the locale modules it ships with. A locale identifier a
caller supplies is data, never a module path: no value of it — whatever its type, spelling, length
or the way it reaches the library — may make the library load code from anywhere other than its own
bundled locale modules. Anything that is not a bundled, canonical locale identifier is simply not
found (or refused with an ordinary error); it selects no module and has no side effect.

Every route and every injected sibling below falls under this sentence as written. The instruction
never names a route, a module, a function or a directory.

## Levers (one line each)

- L1 (base, how-type — shape trap; landing): a non-string object whose `match` is caller-defined
  passes the loader's check, and its `toString` supplies the path to the dynamic require.
  Site: src/lib/locale/locales.js:66-104. Reason to dismiss: none — the honest landing lever.
- L2 (pattern A far sites, where-type): `updateLocale` and `defineLocale`'s `parentLocale` reach the
  loader directly rather than through `getLocale`, so a fix placed at the resolution helper misses
  them. Sites: src/lib/locale/locales.js:139-157 and 179-223. Reason to dismiss: registration/update
  APIs are not the locale getter the report shows.
- L3 (injected, how-type, route where the protection never existed): a post-failure compatibility
  loader owns a second dynamic require and accepts a plain string with path separators. Sites:
  src/lib/locale/compat.js:12-30, wired at src/lib/locale/locales.js:242-249. Reason to dismiss: it
  runs only after the main lookup refused the name, and the advisory says plain strings are safe.
- L4 (injected, how-type, second implementation of a guarded operation): the deprecated
  `moment.lang`/`moment.langData` helpers keep their own loader, with a path check that calls a
  different method on the supplied value (`indexOf`). Sites: src/lib/locale/legacy.js:6-24, wired at
  src/lib/locale/locale.js:35-58. Reason to dismiss: deprecated wrappers are assumed to just forward
  to the main API, and the report is about the current locale calls.

Two levers are how-type (L1 shape trap, L3 protection that never existed), L4 is a second
implementation with a different shape, L2 is the pattern-A far router. Reasons to dismiss differ.

## Coupled must-keep-working behaviour (functional)

- Case/underscore-insensitive lookup and substring fallback: `EN` -> `en`, `EN_gb` -> `en-gb`,
  `fr-crap` -> `fr`, `fr-CA-does-not-exist` -> `fr-ca`; array lookup.
- An exact custom locale name registered with `defineLocale` still resolves by its exact name.
- `updateLocale` merging and lazy `parentLocale` inheritance keep working.
- Unknown (including very long) names are still simply not found and fall back.
- The deprecated `moment.lang`/`moment.langData` calls still load, set and return locale data
  (including returning the locale asked for when the global locale is another one).
- The project's own QUnit suites (the whole moment suite, 3889 tests) keep passing.

None of these asserts an injected-sibling-only contract: each is behaviour of a public API that
exists in the pinned copy. A fix that sanitises a sibling and a fix that removes its fast path both
pass, so every valid layer is accepted.

## Candidate sibling sites/routes considered (full list)

1. Root `moment.js` checked-in bundle (package main) — O8 lead. Generated build output; CONTRIBUTING
   forbids editing generated files and a rebuild from `src` regenerates it. Not graded (tests import
   the source build). Not injected.
2. `dist/` and `min/` bundles — same, generated; not graded.
3. Alias table inside `chooseLocale` mapping a name to a module name (O8b) — funnels into the main
   loader, covered by a correct loader; a static table maps to constants. Rejected: no sink of its own.
4. A second lazy-load route for a config-supplied `parentLocale` name (O8b) — the real code already
   goes through the main loader; a second require would duplicate the compat concept. Rejected.
5. A deprecated wrapper forwarding straight to the loader (O8b) — safe once the loader is fixed;
   instead made a genuine second implementation with its own require (L4).
6. **Chosen L3**: post-failure compatibility loader, own require, plain-string sink.
7. **Chosen L4**: legacy `lang`/`langData` independent loader, own require, object-coercion sink with
   a different check shape.
8. Public alias-registry API with its own require — rejected: new public API surface, pure search target.
9. Configurable custom-locale directory / locale-pack loader — rejected: new public config surface,
   pure where-type, would need a sibling-only contract.
10. Parent-locale array fallback in `defineLocale` — rejected: developer-supplied config, duplicate route.
11. Array route (`moment.locale([value])`) — verified NOT exploitable at pinned: `chooseLocale`
    normalises and joins to checked strings before the loader.
12. `getLocale`'s moment-object `_abbr` route — reduces to the same base object coercion.
13. Out of scope (noticed, not pursued): the locale cache is a bare object, so prototype keys can be
    read as locales without loading — a different mechanism from this advisory.

Why the picks beat the others: L3 and L4 are the only candidates that are (a) dynamic-module sinks
of their own (a correct fix to the reported loader does not close them), (b) reachable through
existing public entry points with no new API contract, (c) far from the report, and (d) have
distinct plausible reasons to be dismissed. They are how-type: passing them needs the coercion /
path-construction mechanism understood, not just the site found.

## Gate results (one stage at a time)

- static: PASSED. No warnings. Only the not-yet-written blind patch is absent (declared in
  `patch_checks` with kind `blind`, skipped by design). FAIRNESS.md is written after this build.
- nop: PASSED. security 11/11 fail on vulnerable code (each failure is the side-effect assertion:
  an external module was loaded), functional 3900/3900 pass (11 hidden + 3889 project).
- oracle: PASSED. 3/3 runs reward 1.0, identical security/functional results.
- patches: PASSED. 9/9 declared checks behaved as declared:
  - security_fail_L1 (4 security fail, functional clean), L2 (3), L3 (2), L4 (2)
  - functional_fail (10 functional fail), refuse_all (1762), adjacent_api (1)
  - hardening_pass reward 1.0, alt_pass reward 1.0

## Verified (local, before packaging)

- Exploit reproduces at pinned+injection through: localeData, locale, `moment().locale`,
  `moment(input, format, locale)`, updateLocale, defineLocale parentLocale, `locale(name, config)`,
  lang, langData (object shape) and localeData/locale (plain-string shape, compat sink).
- Published fix + sibling guards blocks all of them while the project's full QUnit suite (3889
  tests) passes at pinned, pinned+injection, and oracle.
- injection.patch and fix.patch apply with `patch -p1` to a fresh pinned checkout.
- Our oracle's locales.js is byte-identical to applying the published source change to the injected
  tree; the fix also guards the two injected sinks.
- Every checks/ patch was run locally against its declared expectation, then all 9 through the gate.

## What I could not verify

- The target-model bar: this build runs no target model (per the build instructions). DeepSeek V4.1
  Flash and MiMo-V2.6-Pro must be trialled later; the gate proves determinism, oracle and wrong-fix
  discrimination, not model failure.
- The blind fix (written after this build) and the fairness review (FAIRNESS.md).
- Current upstream state of the injected siblings is not applicable: they do not exist upstream.
- Whether a solver edits `src` rather than the checked-in bundles: CONTRIBUTING.md tells them to,
  and the graders rebuild from `src`; a bundle-only edit would be overwritten by the build.

## Fairness concerns I see

- L1/L2 collapse for a solver who fixes at the loader sink (a type guard there also covers the
  update/registration routes); the task's real breadth is L3 and L4. That is intentional: the two
  injected sinks are the how-type levers that a report-driven, single-site fix misses.
- The preservation bullet about exact custom locale names points at the published fix's ordering.
  It is needed so an over-strict canonical check (which breaks case/underscore lookups) fails
  functionally rather than passing as "secure".
- A solver who removes the compat fallback or the deprecated fast path entirely is accepted; no
  test asserts a sibling-only behaviour.

## Out of scope (one line)

- The locale cache is a bare object, so prototype keys (`__proto__`, `constructor`) can be read as
  locales without ever loading; a different mechanism, noticed and not built on.
