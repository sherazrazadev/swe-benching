# A request can drive the operator's terminal

Ember is a terminal dashboard for a Caddy instance. An operator watches it while the instance serves
traffic: it shows the requests Caddy handles and the state of the instance, refreshed as traffic
arrives. A remote client decides the path and the request values Caddy records for every request it
sends.

## What happens

A request whose path carries terminal escape sequences is drawn like any ordinary request. The
operator's terminal does not show those characters; it acts on them, so the display can be retitled,
cleared or otherwise manipulated while the operator is reading it.

## What must be true

No value that a remote client can influence — including a value the product stored or derived
earlier and reads back later — may reach the terminal with terminal control characters intact,
wherever the product writes it for a person. C0 controls (0x00–0x1F), DEL (0x7F) and C1 controls
(0x80–0x9F) must be removed before such a value is written. The printable text that remains must
still be shown: the draw must not be refused, the value must not be dropped or replaced by a
placeholder, and the rest of the display must keep its existing multi-line layout.

Values the product exposes as data — the machine-readable output, and the identities it groups,
sorts and filters by — keep their exact contents, byte for byte. Cleaning applies to what is drawn,
never to the data.

## What must keep working

Everything that works today keeps working exactly as today. In particular:

- Printable text keeps its exact contents: `ZQPWN`, `naïve café`, `日本語` and `🚀 launch` are
  shown unchanged, and an emoji or a CJK character still occupies two display cells.
- A value that contains no control characters is drawn exactly as it is today.
- Anything the product reports as data, and the identities it groups, sorts or filters by, are
  unchanged.

The example above is an example, not the full set of values that must be neutralised.

## Constraints

- Fix the problem and its close variants; do not special-case the example.
- Keep legitimate use working exactly as it does today.
- Do not look up the upstream fix or advisory.
