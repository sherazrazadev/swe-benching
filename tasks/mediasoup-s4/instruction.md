# SCTP association accepted from a forged State Cookie

mediasoup is a WebRTC SFU. Its worker embeds an SCTP stack used for data channels. A plain
transport, and a pipe transport, carry that SCTP traffic directly on their own transport path
rather than inside an authenticated channel.

## Observed impact

On a plain transport with SCTP enabled, a host that can send packets to the transport can send a
single handshake reply — an SCTP COOKIE-ECHO packet carrying a State Cookie that this worker never
produced — and the worker accepts it as the remote peer's answer. The worker sets the association
up with the values carried in that cookie, reports the association as connected, and treats
subsequent SCTP messages from that host as coming from the peer. The sender never had to receive
anything from the worker first.

## Required behaviour

Only a State Cookie that this worker itself generated for the peer, and that is still within its
valid lifetime, may cause an association to be created, continued, restarted or replaced. A
message that carries anything else — a cookie the worker cannot prove it generated, or one that
has expired — must be discarded without creating or changing association state, without the
association being reported as connected, and without sending the peer anything that would let it
believe the association is established. This holds for every message and every path that can
reach an association.

## Contracts

- Protection is the default. An association must authenticate State Cookies unless its transport
  explicitly declares that its SCTP traffic already runs inside an authenticated channel; a
  setting that is missing or left unconfigured must never fall back to unauthenticated cookies.
- Freshness. A State Cookie used promptly (about a second after it was produced) is accepted; a
  State Cookie kept for an hour is not. A small backwards adjustment of the endpoint's clock must
  not make a fresh cookie look expired.
- Everything that works today keeps working exactly as today: two peers complete the handshake and
  carry messages in both directions, a retransmitted handshake message does not disturb an
  established association, a peer that restarts is re-established, and a plain State Cookie is
  still recognized and preserved exactly as before.
- A refusal is silent or an error. No association state changes, the association is not reported
  connected, and no acknowledgement that would complete the handshake is sent.
- The trigger above is an example, not the full set of inputs that must be handled.

## Constraints

- Fix the reported problem and its close variants; do not special-case the example.
- Keep legitimate use working.
- Do not look up the upstream fix.
