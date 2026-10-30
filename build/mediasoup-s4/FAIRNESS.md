# FAIRNESS — mediasoup-s4

## 1. Test fairness

| test (file::name) | asserts | covering instruction sentence | correct fix could fail? | risk |
|---|---|---|---|---|
| security::forged cookie cannot establish an association | hand-built plain cookie → not CONNECTED, listener not connected, no COOKIE-ACK | "Only a State Cookie that this worker itself generated … may cause an association to be created"; "a cookie the worker cannot prove it generated … must be discarded" | no | low |
| security::a modified genuine cookie is rejected | one body byte (localInitialTsn) flipped in a genuine cookie → rejected | "a cookie the worker cannot prove it generated" | no | low |
| security::an expired genuine cookie is rejected | genuine cookie, +1 h → rejected | "a State Cookie kept for an hour is not [accepted]" | no | low |
| security::a forged cookie cannot restart an existing association | TCB stream limits unchanged, no COOKIE-ACK | "created, continued, restarted or replaced"; "every message and every path" | no (guard before or inside the TCB branch both pass) | low |
| security::an unsigned restart cannot take over an association | attacker DATA not delivered; legitimate peer still delivers; INIT still answered | "restarted or replaced" (an INIT is not a valid cookie); "without … changing association state" | no (INIT must still get INIT-ACK — also required by the restart-works functional test) | low |
| functional::two peers establish and exchange messages | both directions work | "two peers complete the handshake and carry messages in both directions" | no | low |
| functional::a retransmitted handshake message does not break the association | still CONNECTED, COOKIE-ACK, messages flow | "a retransmitted handshake message does not disturb an established association"; "exactly as today" | no — RFC 9260 also acks a duplicate COOKIE-ECHO; a one-shot-replay fix contradicts "exactly as today" | medium |
| functional::a promptly used cookie is accepted | +1 s → CONNECTED, COOKIE-ACK | "about a second after it was produced is accepted" | no | low |
| functional::a small backward clock adjustment does not expire a cookie | −5 s → accepted | "small backwards adjustment … must not make a fresh cookie look expired" | no | low |
| functional::a peer restart re-establishes the association | new peer handshakes on an established association | "a peer that restarts is re-established" | no | low |
| project::TestStateCookie | 44-byte plain cookie parses/serialises/clones; IsMediasoupStateCookie true for it | "a plain State Cookie is still recognized and preserved exactly as before" | no if the existing entry points stay callable | medium |
| project::TestAssociation, TestStateCookieParameter, TestStaleCookieErrorCause and the rest of `[sctp]` | the project's current SCTP behaviour | "Everything that works today keeps working exactly as today" | no if the existing `Association` ctor and `StateCookie::Write/Factory` signatures stay callable (defaulted options keep this) | medium |

## 2. Leniency (quality)

Security properties: authenticity → most plausible wrong fix length-only/partial MAC (`sf-length-only`), caught by "modified genuine cookie". Freshness → MAC without lifetime (`sf-no-freshness`), caught by "expired genuine cookie"; unsigned subtraction is caught by the backward-clock test. Secure default → `requireAuthenticatedCookie{false}` (`sf-not-enabled`), caught by four cookie tests. Existing-TCB route → check only in the no-TCB branch (`sf-no-tcb-only`), caught by "forged cookie cannot restart". Sibling route → keep the fast restart (`sf-init-fast-restart`), caught by "unsigned restart cannot take over". Refusal shape → connect/ACK anyway, caught by every security test.

Traps: T1 caught, T2 caught, T3 caught, T4 caught. Wrong fixes **no test catches**: (a) a per-worker (not per-association) secret — a genuine cookie minted for another association would be accepted; (b) a MAC over only the tags/TSNs — `a_rwnd`, tie-tag, capabilities unauthenticated (T1 flips only offset 16); (c) secure default true but Plain/Pipe transport wiring wrong — transports are never constructed at Association level; (d) security tests read only the *first* sent packet, so a late COOKIE-ACK is invisible.

## 3. Hints

- "a setting that is missing or left unconfigured must never fall back to unauthenticated cookies." → names the fix approach (an option/flag). "Protection must not depend on any configuration being present."
- "an SCTP COOKIE-ECHO packet carrying a State Cookie that this worker never produced" → names the chunk and input shape (this is the reported trigger; acceptable, but it is the road map).
- "The trigger above is an example, not the full set of inputs that must be handled." and "its close variants" → announce that a hidden variant list exists. Delete; "every message and every path" already says it.
- "a plain State Cookie is still recognized and preserved exactly as before." → names a format and exists to cover the restored codec suite. Delete; the "everything that works today" clause covers it.

## 3a. Required: generalize

- "A plain transport, and a pipe transport, carry that SCTP traffic directly on their own transport path rather than inside an authenticated channel." → states where the sibling routes live. Replace with a property: "Where SCTP traffic is not otherwise protected end-to-end, a host on that path can send packets straight to the association."
- "a plain State Cookie is still recognized and preserved exactly as before." → format name, exists only for one trap's coupled surface. Fold into: "Every legitimate SCTP behaviour that works today is preserved unchanged."
- "Fix the reported problem and its close variants" → replace with the general property over the outcome, not a variant count.

## 4. Realism

T1–T3 are ordinary half-fixes in the real sink. T4 is injected but reads as a plausible restart-latency shortcut reachable through `ReceiveSctpData` (INIT while established rebuilds the TCB, `sendQueue.Reset()`, new local tag); the rationale comment is coherent and the route is one where protection never existed. Nothing looks planted. The byte-built harness mirrors the project's own `sctpCommon` style.

## Verdict

Gate a: every hidden test is covered by a visible sentence or standard SCTP knowledge, and the primary mechanism (per-cookie proof of origin + freshness, secure by default) passes all of them, including the T4 INIT route via "restarted or replaced … every message and every path". The only residual doubt is that a fix which makes an *incompatible* API change and edits the visible project tests would fail the pristine-restored build — outside the primary mechanism, and the instruction's "everything that works today" points to keeping call sites working.

Quality to tighten: add T1 tampers at a_rwnd/tie-tag/max streams; add a cross-association genuine-cookie replay test; drain all sent packets and assert no COOKIE-ACK anywhere; state that transport flag wiring is ungraded or add a testable seam.

Human review: confirm "plain State Cookie still recognized and preserved" cannot fairly be read as "plain cookies still accepted", and that keeping the existing API signatures callable is an accepted condition.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
