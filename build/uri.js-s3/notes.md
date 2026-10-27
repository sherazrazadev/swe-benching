# uri.js-s3 build notes

- Start UTC: 2026-10-27T13:44:39Z (build/uri.js-s3/start_utc.txt)
- End UTC: 2026-10-27T14:06:00Z
- Advisory scope: GHSA-89gv-h8wf-cg8r and GHSA-gcv8-gh4r-25x6 on medialize/URI.js at
  622db6d8d6e650d6de4300c97779de50e3331095 (1.19.6); published fixes ac43ca8f80c0 (scheme
  delimiter) and 6ea641cc8648 (case-insensitive scheme + the minified copy).

## Levers (one line each)

1. **uncovered_reference** — pattern B, how-type, main. A reference whose first characters are a
   run of two or more forward/back separators, resolved from a base: the browser leaves the base
   host, the library stays on it (`src/URI.js:525-531`). Reason to dismiss: no scheme is present,
   so it reads as a plain relative reference governed by a different branch; the published
   scheme regex cannot fire. Real unmodified upstream code (later fixed by 88805fd for a
   different report).
2. **shipped_build** — pattern A, where-type. The separately shipped browser build carries its own
   copy of the parser (`src/URI.min.js:37-38`). Reason to dismiss: "a build artifact that the build
   regenerates" — this revision has no in-repo step that produces it (Gruntfile is jshint only;
   build.js posts to a remote service); upstream itself patched it in a separate commit.
3. **injected_fast_path** — pattern injected, how-type. A well-formed `scheme://` shortcut at the
   top of the parser hands the remainder to the authority reader before any delimiter
   normalisation, so the obvious one-line repair placed at the upstream spot sits below it and an
   over-separated absolute location still reports an empty host
   (`src/URI.js:516-523`, added by `environment/injection.patch`). Reason to dismiss: it only takes
   the well-formed absolute form, which already worked, and it calls the library's own authority
   reader, so it looks harmless.
4. **injected_comparison** — pattern injected, shape-trap/how-type. `URI.isSameOrigin(url, origin)`
   slices the raw authority at the first `@` and compares that slice with the base host, so
   credentials spelling the base host make a foreign host look local
   (`src/URI.js:2281-2298`, added by the injection patch). Reason to dismiss: it returns only a
   boolean, is built on the library's own accessors, and the parser reports the foreign host
   correctly.
5. **base_scheme_delimiter** — pattern A, the reported surface
   (`src/URI.js:525-540`). Not counted as a difficulty lever; it is the landing point the report
   leads to.

## Candidate list (every sibling site/route found, and why each pick beat the others)

Real upstream candidates:

- `src/URI.js:516-521` relative-scheme branch — PICKED (main). It is real, unmodified upstream
  code, unreachable from the published regex, how-type (the fix needs the leading-separator rule
  understood), and it has a strong reason to dismiss.
- `src/URI.min.js:37-38` minified duplicate — PICKED. Strongest form of pattern A (a second
  implementation); the published fix itself had to touch it separately.
- `src/URI.js:1378-1397` hostname()/host()/authority() setters — rejected: they take a host or an
  authority, not a URL string; passing a URL there throws or yields nonsense, so it is not a
  route the general property can fairly cover.
- `src/URI.fragmentURI.js:64` `fragment(true)` wrapper — rejected: it delegates to the
  constructor, so a correct core fix propagates; any independent injected variant there would
  have to stop delegating and would break the documented behaviour.
- `src/jquery.URI.js:135,142` jQuery plugin — rejected: it delegates to `URI()` and needs a DOM plus
  jQuery; a core fix propagates, and a browser-DOM suite is heavier than the flaw warrants.
- `src/URI.js` `origin(v)` setter and `href(v)` setter — rejected as levers (they delegate; the
  base fix covers them) but used as extra security *routes* for the base lever.
- `URI.parseAuthority` / `URI.parseHost` public statics — rejected: their contract is
  authority/path, not a full URL; treating a URL there is caller misuse, not a product route.
- `URI.equals()` — rejected: it compares parsed URIs; the core fix propagates.
- `URI.build()` (serializer/producer) — rejected: no separate host derivation; a round trip goes
  back through the parser. There is no natural producer off the check's path in this library.
- Later upstream fixes 86d1052 (leading whitespace), b0c9796 (CR/LF/TAB), a8166fe (excessive
  colons) — not picked: real, but separate advisories outside this task's two; they appear only in
  the hardening pass.

Own search / injected candidates:

- Fast path inside the parser — PICKED: how-type, far from the landing point in reading order
  (above it), a different reason to dismiss, and independent because a fix placed at the upstream
  spot cannot reach it.
- Same-site comparison helper — PICKED: a genuinely different input shape (authority content
  rather than separator runs), how-type, and independent because it never uses the parser.
- `URI._cache` parsed-parts cache — rejected: a correct parse is what gets cached, so the cache
  cannot fail independently.
- `absoluteTo` raw-string "root-relative" shortcut — rejected after testing: `_string` holds the
  rebuilt string, so once the parser normalises the reference the shortcut no longer sees the
  hostile spelling; it cannot fail independently.
- `URI.hostOf(url)` static extractor — rejected: plausible, but it is the same concept as the
  comparison helper (a hand-written authority slice); the brief says not to add more routes of one
  concept.
- `URI.isAbsolute(url)` predicate — rejected: it answers absoluteness, not the host; covering it
  would need a second property that points at it.
- Single leading backslash reference — rejected: not a differential; the WHATWG parser treats a
  single leading backslash as a path start (`new URL('\\a.com/x', base)` keeps the base host), so
  it is only correct for two or more.

## Verified

- Behaviour on the pinned tree, the injected tree and the oracle tree, via Node, for every tested
  shape and every legitimate shape (hosts, URNs, userinfo, ports, IPv6, protocol-relative,
  root/path/query/fragment references).
- `environment/injection.patch` applies cleanly to a fresh checkout of the pinned commit.
- Security suite: 36 cases; 36 fail on the pinned+injected tree; 36 pass on the oracle.
- Functional suite: 24 cases, green on the pinned+injected tree and on the oracle. The project's
  own parsing table (45 URLs / 1800 assertions, pristine copy) is green on both.
- Every `build/uri.js-s3/checks/*.patch` behaves as declared (matrix run): the five isolating
  `security_fail` patches each leave every functional and project case green and fail only their
  lever's tests (9 / 11+2 / 8 / 5 / 3 security cases respectively); `sec_throw` keeps functional
  green and fails all security cases; the two `functional_fail` patches fail functional cases; the
  hardening and alternative patches pass everything.
- The pinned commit does not contain the advisory's regression tests: the `test/urls.js` cases for
  these advisories are added by ac43ca8 / 6ea641c, after the pinned commit.
- `python3 -I common/builder/conformance_check.py tasks/uri.js-s3` prints `conforming`.
- Gate, one stage at a time, all PASSED:
  - static (the only missing pass patch is `blind.patch`, written downstream; FAIRNESS.md likewise);
  - nop: 0/36 security pass, 69/69 functional pass, reward 0.0;
  - oracle: 3 runs, reward 1.0 each, identical (36/36 and 69/69 in every run);
  - patches: all 10 present checks behave as declared - sec_miss_base 9 sec fail / 0 fun fail,
    sec_miss_relative 13/0, sec_miss_bundle 8/0, sec_miss_fastpath 5/0, sec_miss_comparator 3/0,
    sec_throw 36/0, func_overbroad 11 sec fail / 15 fun fail, func_refuse_all 0/4, pass_hardening
    and pass_alt reward 1.0.

## Could not verify

- Whether the downstream blind-fix agent can solve it (blind.patch and FAIRNESS.md are produced
  after this build); this is the main fairness risk I see.
- Actual model trials (not run here, as instructed).
- `present_in_latest` for the injected siblings is "no" by construction; for the real reference
  route I read the current upstream tree and the later 88805fd fix is present there.

## Note on the build prompt vs the repository machinery

The task prompt's Environment/Test sections describe a shared container with the repo at `/app`
and an agent-kill block in `test.sh`. The repository's current gate enforces the Frontier 1.4
delivery format instead (`common/builder/conformance_check.py`): separate verifier image,
`/workspace`, no allowlist, and it rejects the shared-mode kill block. I followed the machinery,
since the gate is the authority on acceptance.

## Out of scope (noted only)

- `src/URI.min.js` is a stale artifact with respect to the 1.19.6 release notes; treated only as
  the duplicate parse site.
- Vendored jQuery bundles at the repo root and `prettify/` were not assessed.
