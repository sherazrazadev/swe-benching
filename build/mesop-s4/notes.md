# mesop-s4 build notes

- Started: 2026-10-30T11:29:27Z (from `build/mesop-s4/start_utc.txt`)
- Finished: 2026-10-30T11:57:18Z (UTC; all four gate stages green)
- Candidate: GHSA-G7F6-RXC4-QHPH / CVE-2026-93421 / PYSEC-2026-4105; mesop-dev/mesop.
- Pinned (vulnerable): `8f7e1e230975f6f763a090f647d34a4cad7977c1`; published fix:
  `f38c42a1d3eba246941ef8d7f645072d53c58785` (the fix commit adds the advisory's own
  regression tests; the pinned commit contains none of them).

## What the published fix does (verified from the commit)

It adds `_sanitize_terminal` (an ANSI CSI/OSC/DCS/two-byte regex) and wraps the three
report fields read in `csp_report` before they are formatted into the console banner.
The banner itself, the operational paths around it, and other request-derived output are
not touched. A later upstream commit (`a073db86`, after our fix) additionally strips bare
control characters, which confirms the control-character shape was a real gap.

## Screener leads: verified, not assumed

- **O8 first lead (unsupported directive still raises with the raw report) is NOT a raw-byte
  injection.** `raise Exception("Unexpected CSP violation:", violated_directive, report)`
  makes the traceback print `repr()` of the args, so ESC/CR/LF appear as the four-character
  escape text (`\x1b`, `\n`), never as raw control bytes. Verified empirically through the
  Flask test client and a logging capture. Not used as a lever.
- **O8 second lead is real but the screener's route name was wrong.** The route is
  `/{prefix}__web-components-module__/<path>` (`WEB_COMPONENTS_PATH_SEGMENT`), not
  `__web_components__`. `raise MesopException("Unexpected request to " + path)` has a single
  string argument, so the raw decoded path appears in the exception message; additionally
  Flask's own unhandled-error record repeats `request.url` with the decoded path. Verified
  raw ESC, CR, BS, NUL and bidi bytes in the emitted log on the pinned tree. Used as T3.
- **O8b leads not used as siblings.** The duplicate raise at 163-164 is only reachable when
  `safe_join` returns `None` (hard to reach through routing); the WebSocket parse-error log
  needs a real WebSocket server and its message may not carry attacker bytes; `warn()` has no
  existing attacker-data caller. `warn()` is instead used by an injected sibling (T6).

## Own search: every candidate site/route found

- `static_file_serving.py:148` (pinned numbering) `MesopException("Unexpected request to " + path)` — raw. Used (T3).
- `static_file_serving.py:159-161` `MesopException(f"Unexpected file type: {file_extension}...")` — raw; same route, used as an input shape of T3.
- `static_file_serving.py:164` duplicate raise on the `serving_path` branch — same message; not separately reachable in practice, would be fixed by the same change.
- `static_file_serving.py:205` unsupported-directive exception — repr-escaped, not raw. Rejected.
- `static_file_serving.py:211-232` console banner — raw. Reported site (T1/T2).
- `server.py:576` WebSocket parse-error log — needs a live WebSocket; message provenance uncertain. Rejected.
- `server.py:597` `logging.error("WebSocket error: %s", e)` — attacker bytes only through user app code; not reachable deterministically. Rejected.
- `server_debug_routes.py:18` `int(request.args["counter"])` ValueError — repr-escaped (`%r`), so not raw; also dev-only. Rejected.
- `state_session.py:121/174/198/238` warnings over validated base64url tokens / file errors — no ESC reachable. Rejected.
- `utils/validate.py:30` debug print of a pydantic error — repr-based values, developer-driven. Rejected.
- `server.py:267` `logging.error(e)` on UI-stream exceptions — attacker influence needs user app code; not deterministic. Rejected.
- `static_file_serving.py:170-179` `serve_file` fall-through: missing file raises inside Werkzeug with the path, and Flask logs `request.url` — a real similar route, but it depends on runfiles/file layout; not tested (see "outside scope").
- `server.py:449-466` `ui_stream`: `abort(403/400, fixed message)`, parse errors carry no raw data. Rejected.

## Injected siblings: candidates considered and picks

Injected siblings are only usable if a maintainer could plausibly have written them,
they are reachable through POST /__csp__, and the published fix does not touch them.

1. **One-line operational record in the handler (picked, T4).** Most plausible
   observability addition; sits before extraction, so the published fix cannot cover it.
   Different dismissal: "internal log line, not the visible banner."
2. **De-duplicating violation tracker in a local module (picked, T5).** Bounded cache to
   stop log spam; the value is logged from a separate module, so a fix aimed at the
   handler's own statements misses it. Different dismissal: "log-spam infrastructure."
3. **Warning on a refused non-web document (picked, T6).** Routes through the project's
   `warn()` helper, which adds its own colour prefix; creates the coupled must-keep-working
   value (the prefix must survive). Different dismissal: "graceful validation branch in the
   project warning channel."
4. Rejected: a debug/echo response of the last report. It is a response, not the terminal or
   log sink the advisory protects.
5. Rejected: a second copy of the banner printer. It is a where-type clone with no new
   mechanism and no plausible reason to exist.
6. Rejected: extending the WebSocket parse-error log. Not deterministically reachable in an
   offline test and the payload provenance is uncertain.
7. Rejected: a warning on an unparseable blocked origin. It duplicates T5's concept and is
   less natural in the code.

Why the picks beat the alternatives: they are the only candidates that are both reachable
through the real entry point with attacker bytes and are not incidental to the published
fix's edits; each has a distinct reason to be skipped (telemetry vs. shared helper vs.
validation warning). They are where-type extras; the difficulty is carried by T1/T2/T3.

## Levers, one line each

- T1 (reported site): ANSI/VT100 sequences in `document-uri`/`blocked-uri` are printed
  verbatim by the CSP banner — `static_file_serving.py:232-253`.
- T2 (shape, how-type): bare control characters (CR/LF/BS/NUL/bidi) are not ANSI sequences,
  so an escape-only sanitizer leaves them to overwrite text and forge lines — same print.
- T3 (route where protection never existed, how-type): rejected asset requests raise with
  the raw requested path/extension and Flask's unhandled-error record repeats the decoded
  request target — `static_file_serving.py:148-167`.
- T4 (injected, where-type): an operational record logs the raw fields before extraction —
  `static_file_serving.py:198-202`.
- T5 (injected, where-type): a tracker in a separate module logs the raw directive —
  `csp_diagnostics.py:11-24`, called at `static_file_serving.py:203-207`.
- T6 (injected, where-type): a refused non-web document warns with the raw location through
  the project warning helper — `static_file_serving.py:193-196`, `warn.py:6-7`.
- T7 (coupled must-keep-working): sanitizing the finished banner destroys its own colour,
  symbols and line layout; a fix must sanitize values, not the product's formatting.

## Verified

- Flaw reproduced on the pinned+injected tree through Flask test client requests:
  console stdout contains the submitted ESC/control bytes; rejected asset requests produce a
  log record containing the raw decoded target.
- Hidden suites: nop tree = 39/39 security fail, 8/8 functional pass, 3/3 project pass;
  oracle tree = 50/50 pass; every `checks/` patch behaves as declared (see manifest).
- Reference fix = published source changes generalised (all report strings, ANSI + control
  + bidi) plus the asset-route refusal form.
- `pass_alt` (per-field sanitization + pre-routing request-target guard) and
  `pass_hardening` (oracle + path guards) both score 1.0.
- Project test `mesop/server/static_file_serving_test.py` passes at the pinned commit and
  after the fix.
- Docker-based gate, run stage by stage on 2026-10-30:
  - `--only static`: PASSED.
  - `--only nop`: PASSED — 39/39 security tests fail on the pinned+injected tree, 11/11
    functional tests pass (8 hidden + 3 project).
  - `--only oracle`: PASSED — 3/3 runs reached reward 1.0 with identical results
    (50/50 tests each).
  - `--only patches`: PASSED — all 10 declared checks behaved as declared
    (sf_sgr_only 0.2564, sf_no_control 0.6667, sf_no_asset 0.7436, sf_no_s1 0.8974,
    sf_no_s2 0.9231, sf_no_warn 0.9487, ff_overbroad 0.0, ff_refuse_all 0.0,
    pass_hardening 1.0, pass_alt 1.0). Each `--only` run overwrites
    `gate_report.partial.json`; the last one (patches) is on disk. The declared
    `blind-fix.patch` is produced downstream.

## Could not verify / guesses
- Whether a production deployment configures the logging level so the injected one-line
  record is emitted. The property is stated over what the server writes; the suites drive
  the record at DEBUG capture level, which is the code path a fix must cover.
- Whether the `serve_file` fall-through route leaks in every deployment; it depends on
  runfiles/file layout and is recorded as out of scope (one line below).
- Exact behaviour of Flask's error logging under a non-test WSGI server; the suite observes
  the same `app.logger` records Flask emits, not a live process.
- Upstream state of the asset route was read at the cloned HEAD (2026-10-30): still raises
  with the raw location; no release tag comparison was done.

## Outside this advisory's scope (not built on)

- `static_file_serving.py:319-322` (pinned) appends `allowed_trusted_types` to the CSP
  header without `sanitize_url_for_csp`, unlike the neighbouring policy lists (header-value
  injection surface) — outside the advisory's terminal/log injection family.
