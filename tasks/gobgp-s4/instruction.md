# OPEN capability values are decoded from bytes outside their declared length

## The system

This project is a BGP routing daemon written in Go. It is also a Go module that other
programs import to build and parse BGP messages. A BGP session starts when two peers
exchange OPEN messages. An OPEN message carries optional parameters, and the capability
parameter carries a sequence of capabilities. Each capability has a code and a declared
value length; typical ones describe the peer's four-octet autonomous-system number, the
address families it supports, or its graceful-restart settings.

## Observed impact

A peer, or any program feeding the library a message from an untrusted source, sends an
OPEN message whose four-octet autonomous-system capability declares a value length of
zero and is immediately followed by another capability. The message is accepted, and the
autonomous-system number the daemon associates with the peer is taken from the bytes of
that following capability. The session is then handled as a peer with an AS number the
OPEN message never declared. The same message shape can put other capability values, and
fields inside those values, on bytes that belong to a different capability.

## Security property (invariant)

No value decoded from an OPEN message may be formed from bytes outside the length
declared for it. Each capability's value, and every length-delimited field inside that
value, must be read only from the bytes its own declared length covers. A capability
whose declared length cannot hold the value it carries must be rejected with an error;
for a value whose size the protocol fixes, a declared length that is not exactly that
size is also a violation and must not be accepted. This holds for every capability code,
whatever the capability means, and for every way the library decodes one: a complete OPEN
message and a single capability decoded through the library's public API are both
covered.

An input that violates this property must be refused by returning an error. It must not
be accepted, and it must not be refused by panicking.

## Keep working

Everything that works today keeps working exactly as today. In particular:

- one optional parameter may legally carry several capabilities, so the buffer a decoder
  receives for one capability normally extends past that capability's declared length,
  and that must not be treated as an error;
- a capability may legally declare a length of zero when it carries no value;
- a graceful-restart capability may legally carry only its flags and time, with no
  address-family entries;
- a capability whose value is consistent with its declared length still decodes to
  exactly the same value as today;
- a capability the project does not recognise still keeps its value.

## Examples are examples

The zero-length four-octet-AS case above is one instance of the problem, not the full set.
The guarantee applies to every capability and to every field inside a capability's value.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or advisory.
- Do not special-case the example.
- There is no network access.
