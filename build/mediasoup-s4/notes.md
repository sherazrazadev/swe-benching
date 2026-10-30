# mediasoup-s4 — build notes (build-v1, pattern A, injected track)

Start UTC: 2026-10-30T15:02Z
End UTC: TBD (filled when the gate has run)

Project: versatica/mediasoup (C++20 worker, meson/ninja, Node layer).
Advisory: GHSA-p7x2-g5cq-fhmq / CVE-2026-55663 (CWE-345), fixed by
9c1a90a8f9206b965e727d134846fb42df4980a7 ("SCTP: authenticate State Cookie in
plain and pipe transports"). Pinned vulnerable commit
7164c6ba1c31accc8dc39c08106c7ff6fd381ddd.

## What the flaw is (verified in the pinned tree)

`RTC::SCTP::StateCookie::Parse()` accepts any 44-byte buffer whose first 8
bytes are `msworker` and whose magic2 at offset 38 is `0xAD81`; it
authenticates nothing (`worker/src/RTC/SCTP/association/StateCookie.cpp:14-37`).
`Association::HandleReceivedCookieEchoChunk()` then adopts the cookie's local
and remote verification tags, initial TSNs, a_rwnd, tie-tag and negotiated
capabilities and creates a TCB / sets ESTABLISHED
(`worker/src/RTC/SCTP/association/Association.cpp:1679-1759`). On a plain
transport (SCTP outside DTLS) a remote host that never ran a handshake can
therefore send one COOKIE-ECHO and be treated as the peer.

The published fix adds a per-association random secret, an HMAC-SHA1 over the
cookie, a creation timestamp with a 60 s lifespan, a MAC+staleness check before
the with-TCB / without-TCB split, a Stale Cookie ERROR, and an internal
`SctpOptions::requireAuthenticatedCookie` flag wired to true from Plain/Pipe
and false from WebRtc/Direct. Source diff only was used; the fix commit's own
test additions were not copied.

## General security property (stated once, used by every test)

An SCTP association (and the transmission-control state that backs it) must only
be created, continued, restarted or replaced on the basis of a State Cookie that
this worker itself generated for the peer, and only while that cookie is still
within its valid lifetime. A message carrying a State Cookie that the worker
cannot prove it generated, or that is no longer valid, must be discarded without
creating or changing association state, without reporting the association as
connected, and without sending the peer anything that would let it treat the
association as established. This applies to every message and every path that can
reach an association.

The report describes impact and one trigger on the reported path only; it never
describes a far site, an uncovered route or the injected sibling.

## Test surface

Direct `RTC::SCTP::Association` + `MockShared` + `MockAssociationListener`, the
same surface the project's own `TestAssociation.cpp` uses (`makeSctpOptions`,
`ConsumeFirstSentPacket`, `AdvanceTimeMs`). Packets are built and parsed
byte-for-byte in the test (own CRC32c), never with product helpers, so a
hardened product cannot crash the tests' bookkeeping. The transport classes are
NOT constructible without a live libuv/worker loop (their constructors create
UDP sockets and use the full `SharedInterface`), so the transport-flag wiring of
the published fix is not graded directly; the instruction states the secure
default as a contract and the tests construct associations with default options.

## Candidate sibling sites / routes (full list before picking)

Screener leads (O8 / O8b) and my own search of `worker/src/RTC/SCTP` and the
transport layer:

1. WebRtcTransport / WebRtcServer SCTP route (DTLS-protected). Published fix
   explicitly opts out. Must keep working, not a must-fix site; also not
   constructible in an Association-level test. Not used.
2. Client role: `HandleReceivedInitAckChunk` stores the peer's cookie opaquely
   in `TransmissionControlBlock::SetRemoteStateCookie` and echoes it back. It is
   the peer's cookie, not one this endpoint generated, so the property does not
   and should not apply. Rejected (not covered by the property).
3. `StateCookieParameter::SetCookie()` as a second way to place a cookie in an
   INIT-ACK without the MAC-appending writer. It is a producer, not a sink: a
   plain cookie emitted there is *rejected* by a correct verifier (a legitimate
   handshake failure), it does not let a foreign cookie in. Rejected as a
   security sibling.
4. Transport composition / a further transport subclass that forgets the flag
   (O8b #3). Not reachable at Association level; constructors need
   libuv/UDP/full SharedInterface. Rejected as untestable, and with a secure
   default it is not a security gap anyway.
5. `TransmissionControlBlock::SendBufferedPackets` echoes the stored remote
   cookie in COOKIE-ECHO. Client-side echo, not a sink. Rejected.
6. `StateCookie::Clone` / `SoftClone` truncation of the authenticated trailer.
   Affects serialisation of cookies we already verified; would break a
   legitimate handshake, not admit a foreign cookie. Rejected (functional-only,
   and covered by the project's own cookie codec tests).
7. `HandleReceivedCookieEchoChunkWithTcb` conditions A/B: a COOKIE-ECHO that
   arrives when a TCB exists can drop the TCB and rebuild it from the cookie.
   Real accepting route into TCB replacement. The published fix covers it by
   placing the check before the split. Used as a NATURAL far-site lever (T3),
   not injected.
8. COOKIE-ECHO on a CLOSED association re-establishes it (no-TCB path). Also
   covered by the published fix's pre-branch check. Not selected separately;
   same route family as T3/engine.
9. `HandleReceivedInitChunk` peer-restart handling (`State::ESTABLISHED` +
   INIT): at pinned upstream it creates no TCB, it only sends a new INIT-ACK and
   waits for the COOKIE-ECHO. **Injected** a plausible fast-restart shortcut
   that rebuilds the TCB immediately from the INIT, i.e. a second TCB creation
   site reachable from `ReceiveSctpData` with no cookie at all. SELECTED (S1).
10. COOKIE-ECHO bundled with DATA: a "0-RTT data" fast path in `ReceiveSctpData`
    that builds the TCB before the chunk loop. Same shape as #9 (second sink
    that bypasses the check) but a more contrived optimisation and duplicative
    of #9. Rejected to keep one injected sibling with a clear rationale.
11. `CookiePreservativeParameter` (peer-requested cookie lifespan). Parsed but
    unused upstream; making the freshness window peer-controlled would require
    injecting the freshness mechanism itself (which the solver writes), so the
    producer cannot be forced to be used by the check. Rejected.
12. `DetermineSctpImplementation` reads the peer cookie's magic. Metrics only,
    no association state. Rejected.
13. Active role `Connect()` / `MayConnect()` building a TCB from an INIT-ACK.
    The peer answers the INIT; no cookie of ours is involved. Out of the
    property. Rejected.
14. DATA / I-DATA without a TCB: `ValidateHasTcb()` drops them. Not a sink.
15. CRC32c / zero-checksum validation: previous advisory (#1828), out of scope.
16. Later upstream hardening #1856 (limit effect of cookie tampering, zero-VT)
    and #1867 (constant-time compare): different, later protections; out of
    scope. Noted, not built on.

Why #9 beat the others: it is the only candidate that is (a) a real second sink
(a TCB is built from remote input without the protected check), (b) reachable
through the real entry point (`ReceiveSctpData`), (c) covered literally by the
property as written ("created, continued, restarted or replaced"), (d) placed
where the published fix never touches, and (e) code a maintainer could plausibly
have written with a normal performance rationale. #10 duplicates its shape with
a less plausible rationale; #3/#5/#6 are producers/echoes that a correct
verifier already rejects; #4 is untestable; #2/#13 are outside the property.

## Levers (each with a different reason a solver skips it)

T0  ENGINE (landing point, not a far-site trap). Forged 44-byte cookie, no TCB,
    `Association.cpp:1679` handler. Security test: no CONNECTED, no COOKIE-ACK.

T1  AUTHENTICITY OF EVERY BYTE — HOW/shape. The check must actually verify a
    keyed MAC over the whole cookie, not merely require the authenticated
    length. Security test: take a genuine cookie from a real handshake, flip one
    byte inside the pre-existing 44-byte body, recompute the CRC32c, deliver;
    must not connect. Reason to skip: "rejecting the plain/44-byte form or
    requiring the longer form already closes forgery".
    where: worker/src/RTC/SCTP/association/StateCookie.cpp (verification).

T2  FRESHNESS — HOW. A cookie generated by us must stop being usable after its
    short lifetime. Security test: real handshake up to the COOKIE-ECHO, advance
    the receiving association's clock by one hour, deliver; must not connect.
    Reason to skip: "authentication is the fix; replay later is a separate,
    lower-severity concern".
    where: worker/src/RTC/SCTP/association/Association.cpp (cookie-echo check).

T3  EXISTING-ASSOCIATION ROUTE — HOW/route. A COOKIE-ECHO that arrives while a
    TCB exists can replace that TCB (RFC 9260 5.2.4 A/B); the same proof must
    apply there. Security test: establish a real association, then send a
    crafted 44-byte cookie with the association's local verification tag and a
    different remote tag; the TCB parameters must not change and no COOKIE-ACK
    may be produced. Reason to skip: "the peer is already connected; this is a
    duplicate/retransmission path, so the check only belongs where there is no
    TCB".
    where: worker/src/RTC/SCTP/association/Association.cpp:1772 (WithTcb).

T4  INJECTED SIBLING (S1) — route where the protection never existed. An INIT
    received while the association is ESTABLISHED rebuilds the TCB immediately
    from the INIT (new local tag/TSN, attacker initiate tag/TSN/a_rwnd), so the
    attacker can then send DATA using the tag it just learned from the INIT-ACK.
    Security test: establish; inject an INIT with chosen values; send DATA with
    the tag from the INIT-ACK; no message may be delivered and the legitimate
    peer must keep working. Reason to skip: "an INIT from an already-connected
    peer is a restart, not an establishment; the code is in the INIT handler,
    far from the COOKIE-ECHO handler the report leads to". realistic_because:
    injected code a maintainer could plausibly write as a restart-latency
    optimisation; it is absent from the published fix.
    where: worker/src/RTC/SCTP/association/Association.cpp, HandleReceivedInitChunk.

## Coupled must-keep-working behaviour (functional)

C1  Two associations complete the handshake and exchange messages both ways.
C2  A retransmitted COOKIE-ECHO on an established association keeps it
    connected (couples with T3: rejecting every COOKIE-ECHO when a TCB exists
    breaks retransmissions).
C3  A cookie used promptly (a couple of seconds) is accepted (couples with T2;
    "always stale" fails).
C4  A small backwards clock adjustment after the cookie was created keeps it
    acceptable (couples with T2; naive unsigned subtraction underflows).
C5  A legitimate peer restart (a new INIT against an established association)
    still re-establishes and carries data (couples with T4; removing the
    shortcut must not break restarts).
C6  The project's own `[sctp]` tests, restored from pristine copies, pass; in
    particular the plain-cookie codec tests in TestStateCookie (couples with
    T1: a fix that rejects plain/44-byte cookies globally breaks the codec).

## Routes and input shapes covered by security tests

- forged 44-byte cookie with valid magic, no TCB (T0)
- genuine authenticated cookie with one modified body byte (T1)
- genuine authenticated cookie older than its lifetime (T2)
- forged 44-byte cookie on an established association (T3)
- attacker INIT + DATA on an established association (T4/S1)
- the refusal form asserted is always "no association state change / not
  connected / no COOKIE-ACK", never one exact status code.

## Wrong-fix checks planned

- sf-length-only.patch           security_fail (misses T1)
- sf-no-freshness.patch          security_fail (misses T2)
- sf-no-tcb-only.patch           security_fail (misses T3)
- sf-init-fast-restart.patch     security_fail (misses T4/S1)
- ff-reject-all-cookie-echo.patch functional_fail (refuse_all)
- ff-reject-plain.patch          functional_fail (over-broad; also adjacent_api)
- pass-hardening.patch           pass/hardening (constant-time compare etc.)
- pass-alt-unconditional.patch   pass/alternative (always authenticate, no flag)
- pass-blind.patch               pass/blind (written downstream)

## Levers, one line each

- T1 (HOW / shape, far site in the cookie codec): a genuine cookie with one body byte
  changed must be rejected; a length-only or partial-MAC check accepts it.
  `worker/src/RTC/SCTP/association/StateCookie.cpp:158`.
- T2 (HOW / freshness, far site in the cookie-echo check): a genuine cookie presented
  an hour after creation must be rejected; a MAC without a lifetime accepts it.
  `worker/src/RTC/SCTP/association/Association.cpp:2492`.
- T3 (route, existing association): a forged cookie arriving while a TCB exists must
  not replace it; a check placed only in the no-TCB branch accepts it.
  `worker/src/RTC/SCTP/association/Association.cpp:1803`.
- T4 (injected sibling, route where the protection never existed): an INIT received
  while established rebuilds the TCB from the INIT with no cookie; the shortcut is
  plausible as a restart-latency optimisation and sits away from the reported
  COOKIE-ECHO handler. `worker/src/RTC/SCTP/association/Association.cpp:1536`.

## What was verified / what could not be

Local matrix (container builds of the pinned+injected and fixed trees):

- Pinned + injected (nop case): security 0/5 pass (all five exploits work), hidden
  functional 5/5 pass, project `[sctp]` 71/71 pass.
- Reference fix (published source fix + secure default + sibling removed): security
  5/5, hidden functional 5/5, project `[sctp]` 71/71.
- Wrong-fix matrix (each check patch applied to the injected tree): see the table
  below. The four single-lever `sf-*` patches leave every functional test passing
  and fail exactly their own security test; `sf-not-enabled` is the secure-default
  mistake and fails four cookie routes while keeping every functional test; `ff-*`
  fail functional tests; both `pass-*` patches score 1.0.
- The hidden tests were also checked to build and run as part of the project's own
  Catch2 binary (inserted into `test_sources`), which is how the verifier runs them.
- End-to-end verifier rehearsal through `tests/test.sh` in the real verifier image
  (pinned+injected workspace, pristine deps restored from `/opt`, pristine project
  tests restored, hidden sources inserted, BUILD as uid 1000, score.py): security
  0/5, functional 501/501, reward 0.0, metrics.json written in the expected shape.
  The ccache prewarm made the grading build take about 40 s instead of ~15 min.
- End-to-end verifier rehearsal on the reference-fixed workspace through the same
  path: security 5/5, functional 501/501, reward 1.0, passed_total 1.0, 106 s total
  (the oracle's changed headers made a few hundred real compiles).

Wrong-fix matrix (measured; each check patch applied to the injected tree and built
in the same container toolchain; security / hidden-functional / project `[sctp]`):

| patch | security | hidden functional | project [sctp] |
|---|---|---|---|
| sf-length-only | 4/5 (tamper fails) | 5/5 | 71/71 |
| sf-no-freshness | 4/5 (stale fails) | 5/5 | 71/71 |
| sf-no-tcb-only | 4/5 (restart route fails) | 5/5 | 71/71 |
| sf-init-fast-restart | 4/5 (INIT route fails) | 5/5 | 71/71 |
| ff-reject-all-cookie-echo | 3/5 (setup paths fail) | 0/5 (handshake) | 70/71 (handshake) |
| ff-reject-plain | 5/5 | 5/5 | 70/71 (plain codec) |
| sf-not-enabled (secure default forgotten) | 1/5 (four cookie routes accepted) | 5/5 | 71/71 |
| pass-hardening | 5/5 | 5/5 | 71/71 |
| pass-alt-unconditional | 5/5 | 5/5 | 71/71 |

Build facts measured on the build host (4 vCPU, -j2/-j3, gcc, release):
- a clean `meson setup` plus full `mediasoup-worker-test` build takes roughly
  15-18 minutes; subproject compiles (openssl, libuv, libsrtp, abseil,
  flatbuffers, catch2, libwebrtc) dominate.
- the verifier image pre-builds the pinned tree with ccache and the grading build
  uses the same compiler wrapper and the same `/workspace/worker/build-release`
  path, so the offline grading build should be incremental (few source files and
  two hidden test sources to compile, then link). If ccache misses, BUILD_TIMEOUT
  (2400 s) still covers a full build.
- the FBS headers must be generated (`ninja fbs/FBS`) before compiling; the
  project's `invoke` build does that as a separate step, so the task's BUILD does
  the same.

Known unknowns / could not verify from this host:
- the real Harbor gate results are recorded below as they are produced;
- exact Harbor image-build layer reuse across trials (the first gate run pays the
  image build; later runs reuse layers);
- the ccache hit rate on the grading host (content-based keys, measured at ~40 s for
  the pinned build in the local rehearsal, but not in the real Harbor environment here);
- WAN-visible upstreams: the pinned tree was fetched by SHA; no later commit or
  advisory text is present in it.

## Gate run log

- static: PASSED (2026-10-30).
- nop: PASSED, trial 2026-10-30T16:14:02Z–16:26:16Z: security 5 (all fail on the
  pinned+injected tree), functional 501 (all pass).
- oracle: PASSED, 3 trials 2026-10-30T16:26:22Z–16:32:07Z: reward 1.0 each,
  identical security/functional results.
- patches: PASSED, 2026-10-30T16:32:13Z–16:48:xxZ, all 9 declared checks as declared:
  sf-length-only / sf-no-freshness / sf-no-tcb-only / sf-init-fast-restart each fail
  exactly one security test with no functional failures; sf-not-enabled fails four
  cookie routes with no functional failures; ff-reject-all-cookie-echo and
  ff-reject-plain fail functional tests; pass-hardening and pass-alt-unconditional
  score 1.0. (The pass-blind patch is declared but written downstream.)
- Overall: static PASSED, nop PASSED, oracle PASSED, patches PASSED.

End UTC: 2026-10-30T16:48Z (gate finished; times in the per-stage log above).



