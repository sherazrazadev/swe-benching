# http4k-mm build notes

- Slug: `http4k-mm`
- Advisory: GHSA-PR33-38XX-6R26 / CVE-2026-100725 (http4k/http4k, CWE-200)
- Pattern: B; track: injected
- Pinned (vulnerable): `665b64e` = parent of published fix `6a9b44d` ("Better cookie storage (#1549)")
- Build start (UTC): 2026-10-28T07:03:28Z
- Build end (UTC): 2026-10-28T08:22:25Z

## Design

Main lever: the reported client cookie jar. `ClientFilters.Cookies` attaches every cookie the
storage returns, and the default `BasicCookieStorage.retrieve()` takes no request URI and returns
all of them. A client that talks to two origins sends one origin's cookies to the other.

Levers (each with a different reason a solver dismisses it):

1. **baseline / reported** — core client filter + default storage; no reason to dismiss. Covers
   host-only, Domain (leading dot/case), domain-label boundary, path boundary, RFC default path,
   Secure, and same-name independence. `core/core/src/main/kotlin/org/http4k/filter/cookie/clientCookies.kt:20-36`,
   `core/core/src/main/kotlin/org/http4k/filter/ClientFilters.kt:257-281`.
2. **store-side Domain trust** — a response from one host may name an unrelated Domain and the
   cookie is then delivered to that domain. Real gap: the published fix's new store path accepted
   any Domain; upstream added the check only later. Reason to dismiss: "matching is a retrieve
   concern; the Domain attribute is the server's". Same file as the published fix but a distinct
   trust decision (store vs retrieve).
3. **second implementation** — `Http4kWebDriver` carries its own `CookieStorage`; it returns every
   stored cookie for every request URI, and `manage().addCookie` records no origin. The published
   fix changed only the signature there and left it unscoped. Reason to dismiss: "it is a
   test-only browser simulator, and the upstream fix already touched the file".
   `core/testing/webdriver/src/main/kotlin/org/http4k/webdriver/Http4kWebDriver.kt:235-245`.
4. **redirect forwarding (injected sibling)** — cross-origin redirects rebuild the request from
   the original one. Injected, plausible hardening already strips a named set of sensitive
   headers on a cross-origin redirect but omits `Cookie`, so the code looks handled. Reason to
   dismiss: "the redirect layer already strips sensitive headers". Published fix never touches
   this region. `core/core/src/main/kotlin/org/http4k/filter/ClientFilters.kt` (FollowRedirects,
   injected `crossOriginSensitiveHeaders`), around lines 205-235.

Injection: only lever 4 adds source (the cross-origin sensitive-header block, with `Cookie`
deliberately absent). It is ordinary maintainer code, no deceptive names or comments, reachable
through the public filter composition, covered by the general property, and outside every hunk of
the published fix. Levers 2 and 3 are unmodified upstream code / gaps the published fix left.

Input shapes covered: host-only vs Domain; leading-dot and mixed-case Domain; label-boundary
suffix (`notevil.com` must not grant `evil.com`); configured path and RFC default path; `/api` vs
`/apiv2`; Secure vs http/https; same cookie name stored independently for two origins; a response
setting an unrelated Domain; a cross-origin redirect; a same-name cookie at two origins.

Coupled must-keep-working behaviour: host-less/relative-URI round trip; Domain cookie reaching a
subdomain; path prefixes; Secure over https; expiry removal; same-origin redirects keeping the
header; browser-simulator navigation and redirects within one origin; `manage().addCookie` /
`getCookies`; the existing client-construction API (defaults, caller clock, caller time source).

## Verification performed

- Probe on the pinned tree through the real public entry points: every route leaks (core jar,
  store-side Domain, browser driver, redirect). Probe on the oracle: every route is closed and
  every coupled behaviour still works.
- Hidden suites: measured `security 0/10, functional 16/16` on the pinned tree and
  `security 10/10, functional 16/16` on the oracle, both through the same runner the verifier
  uses (Gradle dependency export, kotlinc, JUnit console XML).
- Every `checks/` patch built and run locally: the five `security_fail` patches leave
  functional 16/16 and fail the named security tests; the three `functional_fail` patches
  break the stated legitimate behaviour; `pass-hardening` and `pass-alt` score 26/26.
- The agent image builds and contains the injected tree with a one-commit baseline and no
  build outputs; the affected project tests (`ClientCookiesTest`, `LocalCookieTest`,
  webdriver `RedirectTest`) pass at the pinned+injected commit inside that image.
- Gate stages (run one at a time): static PASS; nop PASS (security 0/10 pass,
  functional 16/16 pass); oracle PASS (3/3, reward 1.0, identical); patches PASS
  (10/10 declared outcomes).

## Unknowns / risks

- Build time: the project is a large Gradle 9.5.1 / Kotlin 2.3 multi-module tree; the image warms
  the cache for the two affected modules only and then builds offline.
- Upstream published the fix on 2026-05-26 (advisory 2026-06-19), so recall is a real risk; the
  oracle is deliberately stricter than the published fix at this commit (webdriver, store-side
  Domain, redirect).
- `repo_mb`, and the exact screening tree, were not available; the pinned commit was taken from
  the published fix's parent in the upstream repository and its preimage matches the screener's
  cited lines.
- Out of scope, noted only: upstream `FollowRedirects` also forwards `Authorization` /
  `Proxy-Authorization` to cross-origin targets at the pinned commit. The injected header policy
  strips those for realism; the task does not test them.
