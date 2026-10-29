# smarty-s4 build notes

Start (UTC): 2026-10-29T05:24:51Z
End (UTC): (filled at end)
Track: injected. Pattern: B. Pinned: 99c048ce7a590c519b79fbd38ad0143a08183a1f.
Published fix: 31e06fc0 (v5 `{fetch}`) and a1ccdb05 (v4 port, out of the pinned v5 tree).

## Design plan (written before the build)

Product: Smarty 5 (PHP templating engine). A security policy exposes an origin allow-list
(`Security::$trusted_uri`, regexes over `scheme://host`). Two documented users of it exist at the
pinned commit: `{fetch}` (fixed upstream by disabling redirects before `file_get_contents`) and
`{html_image}` (dimensions read with `getimagesize`, which takes no stream context). Any remote read
approved on the strength of that origin allow-list that then follows a redirection to a non-approved
origin is the same SSRF.

One general property (stated once in instruction.md, never per route): when a security policy is
active, no remote resource retrieved while processing a template may come from an origin the policy
does not allow; an approved-origin retrieval must not be diverted to another origin by a
redirection, and the unapproved origin must not be contacted nor influence the result.

### Levers (site / shape / reason a solver skips it)

1. T1 (main, HOW, real Pattern B route where the protection never existed):
   `src/FunctionHandler/HtmlImage.php:115` — `{html_image}` without width+height calls
   `getimagesize()` after `isTrustedUri()`; `getimagesize` follows redirects and accepts no stream
   context. Dismissal: different tag from the report's example and the only redirect-safe form is a
   manual fetch + `getimagesizefromstring`, i.e. it reads as a rewrite of a neighbouring feature.
   Real, unmodified upstream code.
2. T2 (injected, second implementation in a different layer):
   `src/Resource/HttpPlugin.php` (injected http/https template resource; registered in
   `BasePlugin::$sysplugins`). Checks `isTrustedUri()` then reads with `file_get_contents()`
   (redirect-following). Dismissal: resource loading is a different subsystem from a tag, and the
   code does call the trust check, so it looks handled.
3. T3 (injected, check added but read still redirect-following):
   `src/Resource/StreamPlugin.php:57-68` (injected `isTrustedUri` on the resolved remote path, then
   `fopen($filepath, 'r+')`). Dismissal: stream templates are an opt-in legacy mechanism governed by
   the separate `$streams` allow-list; it also calls the trust check.
4. T4 (HOW, coupled must-keep-working): near every site an over-broad fix that always disables
   redirects, or refuses remote reads, breaks (a) no-security-policy behaviour (redirects still
   followed today) and (b) direct reads from an approved origin. Functional tests pin both.

Full candidate list considered before picking (see Design #6):

Real code (upstream, pinned):
- `{html_image}` remote `getimagesize` (PICK: T1) — same documented `trusted_uri` user, different tag.
- `{fetch}` https/ftp/custom file_get_contents branch — the published fix's own site (baseline, tested).
- `{fetch}` http branch fsockopen — does not follow redirects; not a redirect bypass.
- `src/Resource/StreamPlugin.php` fopen (no origin policy at pinned) — REJECTED alone because the
  pinned stream path has no origin trust decision at all (it is gated by `$streams` scheme
  allow-list), so a redirect there does not bypass an origin allow-list. We inject the origin check
  (T3) so the bypass is real and the property applies literally.
- `Template::getStreamVariable()` `{$foo:bar}` fopen — REJECTED: deprecated, no security policy at
  all, and not an origin allow-list route; broadening to it changes the advisory's protection.
- `{fetch}` attacker-supplied `proxy_host`/`proxy_port` — REJECTED (outside this advisory: a direct
  attacker-chosen proxy connection, not a redirect bypass); noted, not built on.
- v4 `libs/plugins/function.fetch.php` — not present in the pinned v5 tree; not reachable.

Injected candidates (O8b + own search), each plausible maintainer code:
- Http template resource (`src/Resource/HttpPlugin.php`) (PICK: T2) — second implementation, different
  layer, calls the trust check, redirect-following.
- Stream resource + origin check (`src/Resource/StreamPlugin.php`) (PICK: T3) — check-then-fopen.
- Legacy `function.fetch.php` through `BCPluginWrapper` — REJECTED: only reachable if the app calls
  `addPluginsDir()` with a bundled plugin dir; that makes the test depend on app configuration a
  blind fix cannot see, and the file is absent from the tree.
- New `{html_picture}`/`srcset` list handler — REJECTED: does not fit any real Smarty feature (a
  `<picture>`/`srcset` element needs no per-candidate dimension fetch), so it is not plausible code.
- New "link preview" handler — REJECTED: invented tag with no product precedent.
- `{eval file=...}` remote — REJECTED: turns an SSRF fix into a remote code evaluation feature and
  changes the protection.

Why the picks beat the others: T1 is the strongest real how-type route (documented trusted_uri user
that cannot take a context). T2/T3 are the most complex reachable injected candidates: both perform
the guarded operation a maintainer would plausibly add next, both call the trust check (so they look
reviewed), and both sit in the resource layer, far from the tag the report leads to. Each has a
different dismissal (different tag/rewrite vs different subsystem vs opt-in legacy stream feature).

### Sites and tests
Security: `{fetch}` https redirect (baseline), `{fetch}` with `assign` (form), `{html_image}` redirect
(no dims; and one-dimension form), http template resource redirect, stream template resource
redirect. Functional: direct reads at every site, no-policy redirects still follow at every site,
local file fetch and local image dimensions, plus the project's own fetch and stream-resource tests.

### Registered routes
Rows appended to `build/audit/uncovered-routes.tsv` for T1, T2, T3.

## Build / verification log
(see end of file)

## Verified

- Pinned+injection reproduces every route through the real entry points (`Smarty::fetch()` /
  `display()` rendering, and `{include}` inside a template): the final task's security suite is
  8/8 failing on the untouched tree and 8/8 passing on the oracle.
- Oracle = published `{fetch}` fix (stream context with follow_location=0) + `{html_image}`
  manual fetch + `getimagesizefromstring` + the same no-redirect context on the injected http(s)
  template resource and on the stream template resource. It keeps 62 functional tests green
  (11 hidden + 51 of the project's own).
- Gate stages (this machine, Harbor in separate-mode): static PASS; nop PASS (security 0/8,
  functional 62/62); oracle PASS (3 runs, each reward 1.0, 70/70); patches PASS: the four
  miss_* patches (0.75, exactly the two security tests of their site, all functional green),
  func_overbroad and func_refuse_all (0.0, the no-policy/direct-read functional tests),
  sec_adjacent_api (0.0, the project's trusted-URI contract test), pass_alt and pass_hardening
  (1.0). checks/blind.patch is intentionally absent; the blind-fix step writes it.
- Project's own tests for the area: PluginFunctionFetchTest, StreamResourceTest, SecurityTest
  (51 tests, 72 assertions) pass at pinned+injection and with the oracle, offline, in the
  verifier image.
- present_in_latest (read-only look at origin/master): `{html_image}` still reads remote
  dimensions through the context-less primitive after the origin check (yes, still open); the
  stream template resource's `fopen` still has no redirect context (yes, still open; master only
  added an unrelated nested-wrapper-scheme check from a different advisory). The http(s) template
  resource is injected and is not upstream code.

## Could not verify

- The bar itself (both target models failing 3/3): decided by trials, not run here.
- Whether a solver will accept the opt-in stream-template route as in scope. This is the main
  fairness risk: the deployment gates stream templates by scheme (`$streams`), while the
  injected code also applies the origin allow-list, so the redirect is a literal origin-list
  bypass, but a solver may read streams as a separate mechanism.
- Tests drive a custom scheme (`remotex`) as the offline transport for the stream resource; a fix
  restricted to `https` would fail it. The property is stated over any remote resource and the
  upstream `{fetch}` fix already generalises over `$protocol`, but this is a design choice.
- The injected http resource and the injected stream origin check do not exist upstream; they are
  plausible maintainer code, not project history.

## Outside this advisory's scope (noted, not built on)

- The v4 port commit a1ccdb05 also bundles unrelated CWE-79 escaping fixes and re-applies the
  secure_dir symlink fix.
- origin/master's StreamPlugin adds a nested stream-wrapper-scheme check from a different
  advisory (CWE-22/-441).
- `{fetch}`'s attacker-supplied `proxy_host`/`proxy_port` opens a direct connection to a
  caller-chosen host; it is not a redirect bypass and was not used.

End (UTC): 2026-10-29T05:39:41Z

Gate reports (partial, one per stage):
- build/smarty-s4/gate_report.partial.json currently holds the patches stage (verdict pass).
- Logs: ~/.tb-graders/cwe/work/smarty-s4/logs/{nop,oracle,patches}.log
- Trials not run (out of scope for the builder); the bar is decided by the later model runs.
