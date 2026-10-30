# http-server-s4 — build notes

- Start (UTC): 2026-10-30T05:14:00Z
- End (UTC): 2026-10-30T06:08:49Z
- Track: injected. Pattern: A.
- Repo: adonisjs/http-server. Pinned: 9088623d39e775b8a6ab4b5f4e2daf50e211c4f2
  (direct parent of the published fix ab607a2958327b6f0019d38f26081e431768877a; the second
  listed fix commit 4548a063 is the same change rebased onto 9.x).
- Advisory: GHSA-2M6Q-8V3H-JQWW / CVE-2026-107718, CWE-601 (open redirect via missing output
  encoding of route parameters in generated URLs).

## The flaw at the pinned commit (verified by running it)

`createURL` (src/client/helpers.ts:100-172) is the single URL builder used by every URL entry
point in the package. It interpolates parameter values verbatim:

- named / optional params: `uriSegments.push(`${value}${token.end}`)` (line 150-151)
- wildcard params: `uriSegments.push(`${values.join('/')}${token.end}`)` (line 133)

So a value `/evil.example.com` in the first segment builds `//evil.example.com`, and
`\evil.example.com` builds `/\evil.example.com`; both parse as a different origin
(`new URL('//evil.example.com', 'https://app.test')` → `https://evil.example.com/`). A value
containing `?` or `#` adds query/fragment structure. The published fix encodes each param value
(`encodeURIComponent(String(value))`) and each wildcard element separately.

## Security property (written once, before choosing routes)

Any value used to fill a route parameter stays confined to the single path segment it fills, in
every URL this library generates from route parameters. A value may never add a path separator, a
backslash, a query or fragment delimiter, or otherwise change the path structure, authority or
scheme of the generated URL. A list of values fills consecutive segments, and each element is
confined to its own segment. Values supplied outside the route parameters (a URL prefix,
query-string values) are structure and are preserved as today.

Every route/site/sibling below falls under this sentence as written.

## Candidate sibling sites found (full list, before selection)

Real code that builds URLs (all funnel through `createURL`, so the published fix covers them —
they are Pattern-A far sites, not siblings):

1. src/redirect.ts:303-315 `Redirect.toRoute` → `router.urlBuilder.urlFor` (the reported landing).
2. src/router/brisk.ts:107-138 `BriskRoute.redirect` → `redirect().toRoute(identifier, params || ctx.params)`.
3. src/client/url_builder.ts:28-70 `createUrlBuilder` / `urlFor` and its `.get/.post/...` methods.
4. src/client/helpers.ts:100 `createURL` — the shared sink (published fix site); also re-exported
   from `@adonisjs/http-server/helpers` (src/helpers.ts:32) and `./client/url_builder`.
5. src/router/main.ts:746-765 `Router.makeUrl` (named + `disableRouteLookup` pattern branch).
6. src/router/main.ts:773-800 `Router.makeSignedUrl` (named + pattern branch).
7. src/router/legacy/url_builder.ts:119-146 `UrlBuilder.make/makeSigned` → makeUrl/makeSignedUrl.
8. src/router/signed_url_builder.ts:27-70 `signedUrlFor` route + pattern branches → createSignedURL.
9. src/helpers.ts:178-206 `createSignedURL` (public `./helpers` subpath) → createURL twice.
10. src/redirect.ts toPath/back — take an already-built URL; no param handling (screener O8b #3).
11. src/helpers.ts appendQueryString — merges a query string, no route params.
12. src/router/store.ts / route.ts toJSON — produce tokens (producer of the check's data), not URLs.
13. src/router/resource.ts:183 — pattern text only.
14. src/response.ts location/redirect — URLs come in as strings; no params.

Uncovered real routes into the sink where the protection never existed: none. Every real caller of
`createURL`/`createSignedURL` is encoded by the published fix because the fix is inside the shared
builder. So Pattern B has no real rows for this advisory (register: none).

Injection room named by the screener (O8b): the `disableRouteLookup` branch of makeUrl, the
double build inside createSignedURL, and extending Redirect.toPath with a param-taking variant.

## Chosen levers

### L1 (main, HOW-type) — list-valued (wildcard) parameters, coupled with the segment join
- Where: src/client/helpers.ts:126-135 (real upstream code; the published fix touches it).
- Shape: a parameter supplied as a list of values fills consecutive segments. The obvious fix
  encodes the joined string, which collapses a legitimate `/users/1/2/3` into one segment
  (functional failure), or the obvious fix forgets this branch entirely (security failure).
- Why a solver dismisses it: a list already looks like "a list of path segments"; the join to `/`
  is treated as structure, and the branch sits 20 lines from the named-param branch.
- Coupled must-keep-working: `urlFor('users.list', { '*': ['1','2','3'] }) === '/users/1/2/3'`;
  `prefixUrl` and `qs` options keep their exact output.
- Security tests: element `/evil.example.com` at a root wildcard; element `\evil...`; element with
  `?`/`#`; object form and positional form; through urlFor, method builders, redirect and pattern
  helpers.

### L2 (HOW-type) — an existing partial escape in a second builder (injected)
- Where: src/client/url_builder.ts (new exported `pathFor`, public `./client/url_builder` subpath).
- Shape: the builder escapes `/` only, so `/evil` is neutralised but `\evil`, `?x` and `#y` still
  alter the URL. Presence of an escape makes the code look protected.
- Why a solver dismisses it: "it already escapes the dangerous character"; it lives in the
  browser-facing subpath, next to createURL, and the reported flow does not use it.
- Coupled must-keep-working: `pathFor` keeps building plain patterns (`/users/:id`, optional,
  wildcard joins) and applies prefixUrl/qs exactly as urlFor does.

### L3 (WHERE-type) — the pattern-mode builders (injected)
- Where: src/router/legacy/pattern_url.ts (new) used by `Router.makeUrl`'s `disableRouteLookup`
  branch, and an independent local builder inside `src/router/brisk.ts` for a new declarative
  `redirectToPattern`.
- Shape: raw interpolation in a copy that never calls createURL, so a createURL-only fix leaves it
  open. The brisk copy takes the params from the request context.
- Why a solver dismisses it: deprecated legacy URL APIs ("the developer passes the pattern
  itself"), and a declarative redirect helper that looks like sugar over the redirect builder.
- Coupled must-keep-working: pattern-mode URLs for plain values, optional params, wildcard lists,
  prefixUrl/qs; declarative pattern redirects for normal params.

Why the picks beat the others: the real far sites 1-9 are all closed by one correct shared-helper
fix, so they add search cost but no mechanism; item 10 is not a param sink; 11-14 do not build URLs
from params. The picked siblings are code that never calls the shared helper and that a solver has
to recognise as URL construction from parameters. L2 is how-type (a check that mishandles shapes);
L3 is where-type but far from the report and reaches a second public surface.

## Sites, routes, input shapes the security tests cover

- Root-level named param (open redirect through `//` and `/\`).
- Named param after a static prefix (`?`/`#` structure injection; extra segments).
- Optional param.
- Wildcard list, object `'*'` form and positional form.
- Non-string value (number) — must stay a value, not structure.
- Route names, route patterns, method-specific builders, signed URLs, legacy builders, direct
  helper exports, declarative redirects.
- Attacker input arriving through the request query and through the request path.

## Coupled must-keep-working behaviour (functional tests)

- `/users/1/2/3` for a three-element wildcard list.
- prefixUrl (`https://adonisjs.com/users`) and qs (`?sort=id&fields%5B0%5D=...`) untouched.
- Plain values (letters, digits, `-`, `.`, `_`) produce byte-identical URLs to the pinned copy.
- Optional param omitted → `/users`.
- Signed URLs verify (`hasValidSignature`) for legitimate values.
- Declarative and handler redirects to routes with ordinary params land on the right path.
- The project's own specs for the area (url_builder, client url_builder, legacy builder, redirect,
  is_valid_redirect_url, router, brisk) pass.

## Injected siblings (injection.patch)

The image applies `environment/injection.patch` to the pinned tree. The published fix never touches
any injected file. All injected code is covered by the one property above and is never described in
the instruction.

1. `src/router/legacy/pattern_url.ts` — `makePatternUrl`, a copy of the pre-fix interpolation used
   by `Router.makeUrl`'s pattern branch (and so by `UrlBuilder.disableRouteLookup().make`).
2. `src/router/signed_url_builder.ts` — a single-pass pattern-mode signed URL builder (build once,
   sign, append the signature), with its own copy of the interpolation.
3. `src/router/brisk.ts` — `redirectToPattern`, whose local builder fills the pattern with
   `ctx.params` when the caller passes none.

Each is a public, documented API with a project test for legitimate behaviour, so a blind engineer
can find it from "every URL the library generates from route parameters".

## Verified

Verified locally with the same Japa runner and file set the verifier uses (node 24, ts-exec):

- Pinned+injected tree: 48/48 security tests fail, 267/267 functional tests pass (15 hidden
  functional + 252 pristine project specs).
- Oracle (published fix + the three injected builders): 48/48 security pass, 267/267 functional
  pass. The project's own full suite (638 tests) passes on the pinned tree, on the injected tree
  and on the oracle; `tsc --noEmit` and eslint are clean for `src` and `tests`.
- Each check patch applied to the injected tree and run through both groups:
  sf_miss_wildcard 10 sec fail / 0 fun fail; sf_miss_pattern_mode 9 / 0; sf_miss_declarative
  6 / 0; sf_report_site_only 39 / 0; sf_only_leading_slash 18 / 0; sf_throw_on_attack 48 / 0;
  ff_encode_joined_wildcard 1 sec fail and 6 fun fail; ff_encode_whole_uri 14 / 66;
  ff_refuse_all 48 / 52; pass_alt_strict_segments 0 / 0; pass_hardening 0 / 0.
- `environment/injection.patch` applies with `patch -p1` to an archive of the pinned commit, and
  `solution/fix.patch` then applies with `git apply`; the four builders each gain the encoding.
- Gate static: PASSED (no leaks, no exact-status assertions, catalogue complete).
- Gate (full run, gate_report.json, 2026-10-30T06:01:57Z..06:08:41Z): PASSED all four stages.
- Gate patches: PASSED (11/11 checks: six security_fail, three functional_fail, the hardening pass and the
  alternative pass; all rewards match the declarations above).
- Gate oracle: PASSED (3 runs, reward 1.0, 315/315 each, identical results).
- Gate nop: PASSED (48/48 security fail, 267/267 functional pass in the real verifier container).
  Two container-only defects were found and fixed on the way: the loopback suites need
  NODE_OPTIONS=--dns-result-order=ipv4first (the image resolves localhost to ::1 while the
  clients connect over IPv4) and the project's certificate-generating test needs the openssl
  binary in both images.
- The instruction contains no advisory id, commit sha, fix-file basename or leak term (checked
  with the gate's own leak checks); no dotted directory is used for the hidden suites because
  Japa's file collector skips dot directories.

## Not verified

- The upstream repository's latest release was not inspected; `present_in_latest` is unknown and
  no register rows were needed for this task (no real Pattern B route exists).
- The two target models were not run (the build rules forbid running trials here); the bar is a
  prediction from the lever structure, not a measured result.
- The verifier image installs dependencies with `npm install --no-package-lock` because the
  shipped `package-lock.json` is out of sync with `package.json` at this commit; the agent image
  and the verifier image resolve independently, so a registry change between the two builds could
  in principle install different patch versions. Nothing in the tests depends on a patch version.
- The signing path of the injected signed pattern builder was matched against
  `createSignedURL` by reading the code and by the project's own signed-URL tests; it is not
  derived from a published implementation.

## Fairness concerns

- The three injected builders are found by reading the URL-building surface, not by the report.
  The instruction states the property over "every URL this library generates from route
  parameters" and the builders are ordinary public APIs with tests for legitimate behaviour, so a
  blind engineer can find them, but a solver that only repairs the reported redirect will miss
  them. That gap is the intended difficulty.
- `env/injection.patch` is visible only inside the image's tree (it is applied at build time and
  the file is deleted); the task folder's environment/ is not part of the agent's workspace.

