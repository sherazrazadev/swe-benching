# mobile-security-framework-mobsf-s4 — build notes

Start: 2026-10-30T07:37:47Z
End: 2026-10-30T08:37:11Z

## Task

MobSF (MobSF/Mobile-Security-Framework-MobSF) at
`c098134845a9f537a4feb64090883865cea5383e`, the direct parent of the published fix
`62563ca429a75b3e5d47a13b958e1d2e7d5e2bbf`. The published fix for this advisory is one hunk in
`mobsf/MobSF/settings.py`: the live `MIDDLEWARE` tuple never carried `CsrfViewMiddleware`; the
middleware only sat in the dead pre-Django-2 `MIDDLEWARE_CLASSES` tuple. The fix commit bundles
four advisories; only the settings hunk belongs to this task. The pinned commit contains no
regression tests for it and the fix commit adds none; the task's own `tests/` suites are new.

## Levers (one line each)

- **T1 (main; pattern B real upstream; how-type)** — `GET /generate_downloads/?hash=&file_type=`
  (`mobsf/MobSF/views/home.py:499`) writes a zip with `shutil.make_archive` and is reached by a
  plain anchor. Restoring the middleware protects only unsafe methods, so a page load still
  changes state. Reason to dismiss: "it is a GET download/helper; the middleware was the fix".
- **T2 (injected; how-type scope trap)** — a per-scan note handler
  (`mobsf/StaticAnalyzer/views/common/notes.py:26`) carries `@csrf_exempt` because the same
  function serves a key-authenticated API wrapper; the same function is wired to the browser
  route `/scan_note/`, so the exemption covers the page too. Reason to dismiss: "the decorator
  belongs to the API client that posts without a token".
- **T3 (injected; how-type ineffective defence / ordering)** —
  `mobsf/StaticAnalyzer/views/common/artifacts.py:25-42` removes the scan's report artifacts and
  only afterwards validates the anti-forgery value (`_does_token_match`), returning a server
  error. The route is also load-triggered. Reason to dismiss: "the handler already verifies a
  token".
- **T4 (coupled must-keep-working; how-type)** — enabling browser-origin protection refuses the
  cross-origin identity-provider callback (`mobsf/MobSF/views/saml2.py:157`) unless that one
  callback is exempted narrowly. Current upstream master indeed carries `@csrf_exempt` there.
  Reason to dismiss: "the callback has no token, so it must be broken/out of scope".
- **Coupled functional values** — read-only downloads without a token; key-authenticated API
  clients with no token; the product's own form/AJAX token shapes (body field and `X-CSRFToken`).
  These fail an over-broad fix (`ff-strict`, `ff-api-exempt`, `ff-saml`).

## General property (written once, before choosing routes)

A request that another site can cause a signed-in person's browser to send must never create,
change or remove anything the installation stores or manages; anything that would change state
must use a method a browser does not use for loading a link/embedded resource and must carry the
session's anti-forgery token. A refused request gets a client error and leaves everything
unchanged. Reads, key-authenticated clients and the external identity-provider callback keep
working. The instruction never names a route, file or mechanism of any lever.

## Candidate sites considered, and why the picks won

Real upstream routes examined:

- `GET /generate_downloads/` (`home.py:499`) — writes a zip, anchor-reached. **Built as T1.**
- `GET /static_scan/<checksum>` (`DynamicAnalyzer/views/android/dynamic_analyzer.py:309`) —
  mutates the recent-scan DB and pulls the APK, but only after `get_device()`; needs a running
  Android device/ADB, so it cannot be confirmed hermetically. Current master already requires
  POST. **Not built** (registered).
- `GET /pdf/<checksum>` (`StaticAnalyzer/views/common/pdf.py`) — generates PDF bytes in the
  response; no persistent artifact, needs wkhtmltopdf. Rejected.
- `GET /logout` (`MobSF/views/authentication.py`) — asks the browser to drop the session;
  low-impact and converting it breaks navigation. Rejected.
- `GET /httptools` (`dynamic_analyzer.py:241`) — starts an external proxy process; needs the
  runtime service. Rejected.
- Dynamic-analysis GET routes (`/screen_cast/`, `/logcat/`, ...) — emulator/device dependent.
  Rejected.
- The ordinary POST surface (`/delete_scan/`, `/change_password/`, `/suppress_by_rule/`,
  `/create_user/`) — this is the surface the published fix protects; used as the baseline
  security tests, not as levers.

Sibling candidates from the screener's O8b and my own search:

- `RestApiAuthMiddleware` setting `_dont_enforce_csrf_checks` for a path prefix — `/api/` is
  already exempt, and a non-API prefix would be a contrived path list. Rejected.
- A second stale `MIDDLEWARE_CLASSES`-style tuple in a deployment settings overlay — this tree
  has no alternate settings module and the app always uses `mobsf.MobSF.settings`, so no
  reachable entry point. Rejected.
- An over-broad `@csrf_exempt` on the identity-provider callback or login — the callback needs a
  narrow exemption; the over-broad direction is a functional failure, exercised by `ff-saml`.
- A legacy GET alias of an existing state-changing route — same mechanism as T1, only a search
  cost (where-type). Rejected as a duplicate.
- A cookie-presence-only check on a new endpoint — the same "looks protected, is not" story as
  T3 but trivially wrong; folded into T3's mechanism. Rejected.
- A route accepting GET and POST with the guard only on POST — a verb variant, on the
  never-add list. Rejected.
- A shared handler with a view-level exemption reused by a browser route — **built as T2**; it
  survives the middleware fix and has a plausible API-driven reason to dismiss.
- A maintenance route whose hand-written guard runs after its side effect — **built as T3**; the
  check looks correct in isolation (it uses Django's own comparison) and fails only on order.

Why the picks won: T1 is the only real, behaviourally confirmed, how-type route the published
fix cannot cover. T2 beats the path-prefix and compat-tuple candidates because it is reachable
through a real browser route and is a mistake a maintainer makes while explaining the decorator
as API-only. T3 beats the cookie-presence variant because the guard is genuinely well formed and
only its position is wrong, which is the deeper (how-type) reading. T4 is the coupled value that
forces a narrow exemption rather than a blanket one.

## Environment findings

- The first `nop` gate run failed with `infra:no_results`: MobSF's URLconf calls
  `utils.print_version()` at import, whose environment check sends the process `SIGTERM` when no
  JRE is found (`JAVA_HOME/bin/java` must exist as a file). The image now installs
  `default-jre-headless` and sets `JAVA_HOME=/usr/lib/jvm/default-java` in both the agent and the
  verifier image; `manage.py`/test imports then survive.
- The injected maintenance route compares the submitted value with Django's own
  `_does_token_match`, which unmasks only a 64-character masked value against a 32-character
  cookie. The live-server harness therefore uses the server's anti-forgery cookie together with
  the page-rendered value when the server sets one, and one consistent 32-character pair when the
  vulnerable build never sets the cookie. Without this, the functional route test fails on the
  vulnerable build for the wrong reason.
- Verified end to end in the real verifier image, offline (`--network none`): the pinned+injection
  artifact gives security 0/8, functional 9/9, reward 0.0 in ~16 s; the reference patch applied to
  the same artifact gives security 8/8, functional 9/9, reward 1.0 in ~15 s.

## Verified

- Pinned+injection (nop): security 0/8, functional 9/9 (live-server suites, Django 6.0.3 and
  6.1.2).
- Reference fix applied from `solution/fix.patch` to a fresh injected tree: 17/17 (8 security,
  9 functional).
- Every check patch run in full: `sf-middleware-only` 5 security failures; `sf-generate` 2;
  `sf-scan-note` 1; `sf-clear-reports` 2; `sf-no-middleware` 4; `sf-crash` 4; `sf-failopen` 3;
  `sf-parser` 4; `ff-strict` 2 functional failures; `ff-api-exempt` 1; `ff-saml` 1;
  `pass-hardening` 17/17; `pass-alternative` 17/17.
- `python manage.py check` passes at the pinned+injection, reference, hardening and alternative
  trees.
- Current upstream (read-only): `generate_download` is still an unrestricted GET that writes a
  zip (present in latest); `trigger_static_analysis` now requires POST (not present in latest);
  `saml_acs` now carries `@csrf_exempt` (the coupled fix T4 asks for).

## Could not verify

- The repository size in MB was not measured.
- The project's only test class drives the real analyzers over the `test_files` submodule and the
  downloaded toolchain; it cannot run offline and does not cover the request pipeline. No project
  test covers this advisory.
- Whether the published fix's SAML breakage was reported; only that current master now exempts
  the callback.

## Register rows (pattern B)

- `mobile-security-framework-mobsf-s4` / T1 `GET /generate_downloads/` — real, unmodified
  upstream; present in latest; built.
- `mobile-security-framework-mobsf-s4` / `GET /static_scan/<checksum>` — real upstream, not
  built (device-dependent); no longer present in latest (POST-only).

## Gate results

- static: PASS.
- nop: PASS — security 0/8 (every security test fails on the vulnerable build), functional 9/9.
- oracle: PASS — three runs, each reward 1.0, security 8/8 and functional 9/9, identical results.
- patches: PASS — every declared check behaved as declared: `sf-middleware-only` 5 security
  failures; `sf-generate` 2; `sf-scan-note` 1; `sf-clear-reports` 2; `sf-no-middleware` 4;
  `sf-crash` 4; `sf-failopen` 3; `sf-parser` 4; `ff-strict` 2 functional; `ff-api-exempt` 1
  functional; `ff-saml` 1 functional; `pass-hardening` 1.0; `pass-alternative` 1.0. The `blind`
  entry is left for the blind-fix step.
