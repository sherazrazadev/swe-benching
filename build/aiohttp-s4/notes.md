# aiohttp-s4 — build notes (plan, written before the build)

- Start UTC: 2026-10-30T17:47Z
- End UTC: 2026-10-30T18:13Z

## Task
- Advisory: GHSA-MFX4-HV73-Q22V / CVE-2026-69243 / PYSEC-2026-3546 — HTTP request smuggling /
  message-framing desync (CWE-444) from switching protocols before the announced body is consumed
  (aio-libs/aiohttp).
- Pinned (vulnerable) c852173947406e2eca65957535ff17d3a4035a03; published fix
  6ae358f0983c3f4d6f67692b2f8e65dc8e091c98 ("Fix body reads after failed WS upgrade", PR #13016,
  the only commit between the two; the pinned tree carries no regression tests for it).
- Pattern A, injected track. source = mined+injected.

## Security property (stated once in instruction.md)
Whenever a request declares a body, by any framing the protocol allows, an application that reads
the request body receives every declared byte, no byte of that body may be interpreted as a
separate HTTP message, and no byte of that body may be treated as data of a protocol the
connection switches to. This holds for every supported protocol switch and in every way the
library can be built or configured.

## Levers (one line each, each with its own reason to dismiss)
- T1 (landing + A, how-type through the coupled must-keep-working and the input shape):
  the readable Python parser sets the upgraded flag at headers-complete and then gates the payload
  branch on it, so an upgrade request that announces a body never gets a body stream; the switch
  must instead be deferred to body completion while no-body switches stay immediate and an
  unsupported upgrade token next to a body stays a normal readable body — aiohttp/http_parser.py:427-443,466-467,514-515,568-582.
  Dismissal: "always build a body stream for upgrade requests" fixes the example and breaks the
  immediate switch / swallows pipelined WebSocket frames.
- T2 (Pattern A far site, second implementation, where-type): the Cython/llhttp parser does the same
  thing through `cb_on_headers_complete` returning 2 and `_upgraded`, with its own state — aiohttp/_http_parser.pyx:478-489,642-656,863-877.
  Dismissal: the `.pyx` looks like the generated/optional accelerator beside the readable parser
  (the reverse of the runtime default when the extension is built).
- T3 (MAIN, Pattern B uncovered route, how-type): an application handler that accepts a protocol
  switch installs the upgraded-protocol reader on the connection while the HTTP parser is still
  holding the announced body; a body that arrives after the header block is then parsed as frames
  of the new protocol. The published fix never touches this layer. — aiohttp/web_protocol.py:408-420 with aiohttp/web_ws.py:389-405.
  Dismissal: "a real upgrade handshake has no body, and the handler opted in, so this is not the
  parser's business" plus "the published fix already defers the parser's switch".
- T4 (injected sibling, shape trap, how-type): a plausible upgrade-aware shortcut in the
  request-body accessor returns an empty body for a non-chunked upgrade request, so a fixer who
  checks the chunked form sees it working while the Content-Length form still loses the body —
  aiohttp/web_request.py `read()` (injected; upstream fix never touches this file).
  Dismissal: it looks like a deliberate product decision, and it does handle the more complex
  chunked framing.

Different reasons to dismiss: T1 "block all upgrades / always make a body"; T2 "that file is the
generated accelerator"; T3 "a real handshake has no body and the handler owns the switch"; T4
"the accessor already handles the hard framing, it is not framing code".

Confirmed on the pinned tree (behavioural probes, both parsers):
- request `Connection: Upgrade` + `Upgrade: websocket` + Content-Length body: `feed_data` returns
  upgraded=True at headers, the payload is EMPTY, and body+following bytes are returned as the
  upgraded tail (server handler `request.read()` returns b"", body bytes become a separate request
  after the response; a request embedded in the "body" is served by the server);
- same with `Transfer-Encoding: chunked`;
- accepted WebSocket upgrade: body bytes delivered to the WebSocket reader as frames, both when
  the body arrives with the headers and when it arrives after the 101;
- unsupported Upgrade token + body, no-body upgrade, CL:0 upgrade, CONNECT and ordinary
  requests behave as today (functional).

Confirmed on the published-fix tree: the Content-Length/chunked deferral works in both parsers;
the accepted-upgrade late-body route still delivers the body bytes to the WebSocket reader.

## Candidate sibling sites/routes found (all candidates, then the picks)
1. web_protocol.RequestHandler.set_parser / web_ws._post_start — handler-level takeover installs the
   new reader while the HTTP parser still has a pending body. CONFIRMED reachable, still broken on
   the published fix. PICKED (T3).
2. http_parser.set_upgraded + web_protocol.finish_response — a declined upgrade whose body is never
   read keeps the pending switch armed; it fires on a later packet and the following pipelined
   request is lost. Reachable and real, but it is a pipelining/hang symptom rather than
   body→protocol reinterpretation, and a correct fix may legitimately close the connection, so a
   fair assertion is hard. REJECTED.
3. http_parser.py read_until_eof arm — the published fix leaves it without the deferral bookkeeping.
   Not reachable through a real request entry point: requests never enable read-until-eof, and a
   101 response is empty-body so it never takes that arm. REJECTED (unreachable).
4. CONNECT branch of the Python parser — sets the upgraded flag before attaching the tunnel payload
   parser. By definition everything after a CONNECT header block is tunnel data, so there is no
   announced body to drop. REJECTED (no violation).
5. Response direction, 101 with Content-Length — a 1xx response cannot carry a body; post-header
   bytes are the new protocol by RFC 9110. REJECTED.
6. Client side (client_proto tail accumulation) — the client never announces a request body for an
   upgrade handshake, and 101 responses have no body; also a role/direction variant. REJECTED.
7. web_request.read() upgrade shortcut — injected. PICKED (T4, the injected sibling).
8. web_request.release()/lingering-drain shortcut — would not produce an observable
   body→protocol reinterpretation under the property. REJECTED.
9. web_protocol message-queue fast paths — upgrade-aware already; injecting here duplicates the
   parser decision and is contrived. REJECTED.
10. http_websocket / _websocket/reader_c — only consume what the protocol feeds; no independent
    framing decision. REJECTED.
11. web_ws._pre_start/_post_start as an injected copy — duplicates T3. REJECTED.
12. HeadersParser.parse_headers upgrade flag — changing the producer only declines the switch (the
    body is then read normally); it cannot produce a body drop. REJECTED.
13. C parser ALLOWED_UPGRADES ({"websocket"}) vs Python ({"tcp","websocket"}) — a real asymmetry,
    but an unrecognised token yields a normal readable request, and using it would be a spelling
    variant. REJECTED.

Picks: T3 (most complex, how-type, far from the report), T2 (real second implementation),
T4 (injected shape trap in an untouched file), with T1 as the landing point. The rejected list is
kept above so the picks and their dismissal reasons can be reviewed.

## Sites / routes / input shapes the security tests cover
- Python HTTP request parser, direct: CL body, chunked body, body split across feeds, pipelined
  request after the body; body must be readable and never appear in the upgraded tail.
- Cython/llhttp HTTP request parser, direct: same shapes.
- Server entry point (real aiohttp.web app, raw socket): declined upgrade with a CL body read by the
  handler; chunked variant; a request embedded in the declared body must not be served; the
  pipelined request after the body must be served.
- Server entry point under both parser configurations (pure-Python and C).
- Server entry point, accepted WebSocket upgrade, body with the headers and body after the 101:
  body bytes must never reach the WebSocket message stream.
- Injected accessor shape: Content-Length body lost, chunked body delivered.

## Coupled must-keep-working (functional tests)
- No-body upgrade switches immediately and the bytes after the header block are the new protocol's
  tail (both parsers).
- Explicit zero-length body upgrade switches immediately.
- Unsupported Upgrade token next to a Content-Length body stays a normal request with a readable
  body (both parsers).
- Ordinary requests (CL and chunked) still deliver their bodies; pipelining works.
- A real WebSocket handshake with no body still upgrades and carries frames.
- CONNECT keeps its tunnelling payload semantics.
- The project's own tests for the affected area (tests/test_http_parser.py from a pristine pinned
  copy) pass; tests/test_web_functional.py was also verified locally (131 passed) but is not in the
  graded set, to keep the suite deterministic.

## Build/verification plan
- Image: python:3.12-slim, pinned aiohttp tree, llhttp submodule checked out at the pinned SHA and
  its C sources generated (node+npm at build time, network is available at build), Cython 3.2.5,
  the .pyx files cythonized (sources only; the accelerated extension is deliberately NOT built in
  the agent image, so the example repro runs on the readable pure-Python parser and the accelerated
  copy is the far site); injection.patch applied.
- Verifier: same base/toolchain, offline; test.sh re-cythonizes from the submission's .pyx and
  builds the extension in place before running the hidden suites, then runs the pure-Python
  configuration with AIOHTTP_NO_EXTENSIONS=1 and the default (C) configuration, plus the pristine
  project parser tests (deselecting three URL tests that are xfail in the C variant, because the
  scorer counts any non-pass entry as a failure; optional compression backends are installed so the
  project suite has no skipped tests either).
- Oracle patch = published fix (both parsers) + T3 protocol-layer fix + T4 removal.
- Checks: sf-miss-py-parser, sf-miss-c-parser, sf-miss-handler-switch (T3), sf-miss-request-read
  (T4), ff-refuse-upgrades, pass-hardening, pass-alt.

## What to verify (and could not)
- Re-run the probes on the final oracle and every check patch against the hidden suites locally.
- Could not verify: how the harness starts services (none needed), or the target-model results
  (not run here by instruction).

## Verification results
- Local dev image (cython 3.2.5, llhttp generated, both parser configurations):
  pinned+injected security 0/8 and 0/8; oracle security 8/8 and 8/8; functional 7/7 and 8/8 on
  both; project tests 708 passed / 0 skipped / 0 failed on the injected tree and on the oracle.
- Gate static: PASSED (only the downstream blind patch and FAIRNESS.md remain, by instruction).
- Gate nop (2026-10-30T18:01Z): PASSED - 16/16 security tests fail on the pinned+injected tree and
  723/723 functional tests pass (739 total, 0 skipped).
- Gate oracle (2026-10-30T18:04Z): PASSED - three runs, each reward 1.0, 739/739, identical.
- Gate patches (2026-10-30T18:13Z): PASSED - 7/7 as declared: sf-miss-py-parser and sf-miss-c-parser each leave the corresponding parser's security configuration failing (8/16) with all functional tests passing; sf-miss-handler-switch fails only the accepted-upgrade late-body test in both configurations (2/16) with functional passing; sf-miss-request-read fails only the two Content-Length delivery tests in both configurations (4/16) with functional passing; ff-always-defer and ff-refuse-upgrades fail functional tests; pass-hardening and pass-alt both score reward 1.0 (739/739, 0 skipped).

## Adjustments made while building (why)
- The accelerated extension is not built in the agent image: the example repro then runs on the
  readable pure-Python parser, and the accelerated copy is a real far site the verifier builds from
  the submission's `.pyx`. The verifier rebuilds it unconditionally, so a `.pyx`-only fix counts.
- score.py counts any JUnit entry that is not a pass as a failure, so the project parser suite is
  run with the optional compression backends installed (no skips) and with the three URL tests that
  are xfail under the C parser deselected (no xfail entries in JUnit).
- JUnit prefixes (`py`, `c`, `project`) keep the two parser configurations' identically named tests
  from overwriting each other in score.py's dict.
