# phpsysinfo-s4 — build notes

- Start (UTC): 2026-10-28T16:17:21Z
- End (UTC): 2026-10-28T16:44:34Z

Advisory: GHSA-786W-P5PM-CVGH / CVE-2026-55584 (phpSysInfo IP allow-list bypass by spoofed
client identity). Pinned `d786ab251e326d9afb9f60906fcdaca8e716ad0e`; published fix
`019fa2d7e568ea11461adb4bd33da5dc87c4b9ab` (parent of the fix = the pin). Pattern B, injected.

## The one security property

No response that reports information about the machine the installation runs on — hardware,
operating system, installed software, runtime configuration — may reach a client whose real
network origin the operator has not admitted; nothing the sender supplies may make a request
admitted. The origin is the connection's peer, or, for a connection from an operator-designated
trusted proxy, the client address that proxy reports. This is stated once in `instruction.md`
and covers every route and sibling below without naming any of them.

## Levers (one line each)

1. **T1 `unprotected-machine-reports` (main, how-type — protection never existed).**
   `tools/cputest.php:1-4` and `tools/distrotest.php:1-3` are real, unmodified web-root scripts
   that print hardware/distribution details and never load the configuration bootstrap, so the
   allow-list decision is never made; dismissal: `tools/README` frames them as developer/test
   helpers, not the monitored application, and they visibly do not touch the app bootstrap.
2. **T2 `duplicate-identity-resolution` (how-type — second implementation).**
   Injected `includes/class.CommonFunctions.inc.php:429-450` (`clientIp()`, a second identity
   resolver that trusts forwarding headers) and `tools/phptest.php:1-34` (a runtime report with
   its own copied allow-list check built on it); dismissal: the script visibly refuses unlisted
   clients, so it reads as already protected, and the flaw is in the copied resolver rather than
   in its absence. The published fix touches neither file.
3. **T3 `trusted-proxy-coupled` (how-type — coupled must-keep-working + mechanism).**
   `read_config.php:39-80` is the reported decision; the fastest fix (ignore forwarding headers)
   closes the bypass but breaks the product's documented reverse-proxy deployment, while
   trusting the headers whenever `TRUSTED_PROXIES` is absent is the same flaw reshaped. The
   functional suite keeps the legitimate proxied client working next to the attack tests.

## Full candidate list and why the picks won

Real upstream routes found in the pinned tree:

| candidate | covered by the property? | decision |
|---|---|---|
| `tools/cputest.php` (hardware report, no gate) | yes | **picked (T1)** — real unmodified upstream, protected data, no protection at all, plausible "test utility" dismissal |
| `tools/distrotest.php` (distribution report, no gate) | yes | **picked (T1)** — same, different data and code path |
| `tools/phptest.php` (runtime report, no gate) | yes (runtime configuration) | **used as the injected sibling's host (T2)** — richest runtime report, "check-up helper" dismissal, and a natural place for a maintainer to have added a copied check |
| `tools/checkdistro.php` | nominally | rejected — iterates `sample/distrotest`, which is absent from the pinned tree, so a stock deployment exposes nothing; no behavioural test is possible |
| `tools/checkpng.php` | no | rejected — lists image file names; not information about the machine |
| `templates/dynamic/css.php` | no | rejected — serves CSS; not host/runtime information, would force stretching the property |
| `js.php`, `language/language.php` | n/a | rejected — already load the shared gate and serve static assets, not host information |
| `index.php`, `xml.php` | yes | kept as **additional security coverage** (two entry points into the shared gate), not counted as a lever (where-type) |
| `tools/speedfan/` | n/a | rejected — data directory, not a web entry point |

Injected sibling candidates:

| candidate | decision |
|---|---|
| second identity resolver in `CommonFunctions` + a standalone report with its own check | **picked (T2)** — strongest form (separate code doing the same guarded operation), plausible for a diagnostic that deliberately avoids the full bootstrap, far from the reported site (a different package plus `tools/`), reason to dismiss: it visibly refuses clients |
| a gate added to `css.php` | rejected — CSS is not host/runtime information; the general property would not cover it literally without stretching |
| a `read_config.php` guard added to a tool | rejected — that is the fix itself, not a sibling gap, and it removes T1 |
| a second defaults-file knob in `phpsysinfo.ini.new` | rejected — no protected-output path of its own; it is documentation for the same decision |
| a second consumer of the resolver that writes an audit line | rejected — a spoofable audit address is not a host-information disclosure, so the one general property would not cover it |

T1 and T2 both need the mechanism understood (not just a site found), are far from the report,
and have different dismissal reasons; together they are the task's difficulty. T3 supplies the
coupled legitimate value that makes the tempting over-broad fix fail.

## Sites, routes and input shapes the tests cover

- Sites: the shared gate at `read_config.php:39-80`; `tools/cputest.php`; `tools/distrotest.php`;
  `tools/phptest.php` + `CommonFunctions::clientIp()` (injected).
- Routes (HTTP GET): `/index.php?disp=xml`, `/xml.php`, `/tools/cputest.php`,
  `/tools/distrotest.php`, `/tools/phptest.php`. The verifier starts the product on loopback and
  writes the product's own configuration file per test.
- Input shapes: `X-Forwarded-For`, `Client-IP`, an allow-list CIDR entry, a trusted-proxy entry
  that is bare / a range / does not contain the peer, the spoofed value naming a proxy address,
  the IPv4-mapped IPv6 form, and no header at all.
- Correlated legitimate values (functional): a listed client, a client inside a listed range, a
  listed client sending its own address, a client reported by a trusted proxy (single, range,
  `Client-IP`, and mapped form), and the same reports for admitted clients.

## Verified

- Reproduced on the pinned commit through HTTP: an unlisted peer (REMOTE_ADDR 127.0.0.1,
  `ALLOWED` naming another address) is served the full XML machine report when it sends
  `X-Forwarded-For` or `Client-IP`; `tools/cputest.php`, `tools/distrotest.php` and
  `tools/phptest.php` return machine/runtime data to any caller.
- Oracle over HTTP: every spoofed form is refused; a configured trusted proxy still admits the
  client it reports; CIDR allow-list and trusted-proxy ranges work; the mapped IPv4 form works;
  all pages and reports are served to admitted clients.
- Verifier harness run locally against the injected tree (nop): 14/14 security tests fail and
  12/12 functional tests pass. Against the oracle: 14/14 and 12/12 pass. Every check patch
  behaves as declared (sf_tools 4 security fails; sf_sibling 3; sf_client_ip 3;
  sf_candidate_proxy 1; sf_proxy_failopen 9; sf_crash 14; func_fail_drop_headers 5 functional
  fails; func_fail_refuse_all 12 functional fails; hardening and alternative 0/0).
- Both patches apply cleanly to a fresh checkout of the pinned commit, and the oracle patch
  reproduces the tested tree.
- Current upstream `main` (cb3ebbc1) still ships `tools/cputest.php` and `tools/distrotest.php`
  without an allow-list gate, so both uncovered routes are present in latest.

## Could not verify

- Target-model behaviour: no trials were run (per the build brief; the pipeline runs them).
- The blind patch: written downstream by the blind-fix step.
- The project has no test suite (only a PHP-lint CI across 5.5–8.4); the image checks
  `php -l` over every PHP file instead.
## Gate results (stages run one at a time, in order)

- `--only static`: PASSED (the only declared-but-absent check is the downstream `blind` patch).
- `--only nop`: PASSED — 14/14 security tests fail on the pinned+injected tree, 12/12 functional
  tests pass.
- `--only oracle`: PASSED — 3/3 trials, reward 1.0, identical results (14 security + 12
  functional each).
- `--only patches`: PASSED — 10/10 checks as declared:
  `sf_tools` 0.7143 (4 security fail, 0 functional), `sf_sibling` 0.7857 (3/0),
  `sf_client_ip` 0.7857 (3/0), `sf_candidate_proxy` 0.9286 (1/0), `sf_proxy_failopen` 0.3571
  (9/0), `sf_crash` 0.0 (14 security fail, 0 functional), `func_fail_drop_headers` 0.0
  (5 functional fail), `func_fail_refuse_all` 0.0 (12 functional fail), `pass_hardening` 1.0,
  `pass_alternative` 1.0.
- Stage reports kept as `gate_report.static.json`, `gate_report.oracle.json` and
  `gate_report.patches.json`; the stage logs are the gate's own output.
- After the `patches` stage, the reference fix gained a defensive hardening of the shared
  resolver (the now-unused injected helper) and `static`/`oracle` were re-run on the final tree
  (both pass; oracle 3/3 reward 1.0). The `patches` stage replaces `solution/fix.patch` with each
  check patch, so those checks are independent of that reference-fix-only change and their
  passing result stands.

## Scope note

`xml.php:42` echoes `$_GET['callback']` after a `/[\w\?]/` test in JSONP mode; that is a
reflected-script concern in a different protection than this advisory's allow-list and was not
pursued.
