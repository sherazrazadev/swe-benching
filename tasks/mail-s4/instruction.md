# Keep the address the library reports faithful to the header

## The system

This is a Ruby library for reading and writing email. Applications use it to
parse message headers and to answer questions such as "who sent this?" and
"what name is shown with this address?". A header may carry encoded words:
short `=?charset?Q?…?=` or `=?charset?B?…?=` sequences that stand for non-ASCII
characters, mixed with ordinary literal text.

## Observed problem

An application reports the sender of a message from its `From` header. Using
`Mail::Address`, it asks for the address and the display name in:

    From: "John Doe" <=?UTF-8?Q?spoof?Q?agent?=@example.com>

and gets the mailbox `agent@example.com` and the formatted sender
`John Doe <agent@example.com>`. That is not what the header spells: the
characters `spoof?Q?agent` have disappeared from what the application shows. A
reader who trusts the displayed sender is looking at a different mailbox from
the one the header actually contains.

## Security property (invariant)

For every address the library reports, every piece of text it reports for that
address must be exactly what the header's text spells once genuinely encoded
words are decoded. Text that merely resembles an encoding marker, and a marker
that has no matching terminator, are ordinary literal text and must survive
unchanged. No input may cause characters to be dropped, re-read as part of a
marker, or replaced with different text, so a crafted header can never make the
library report a mailbox or a displayed name that the header does not spell.

The same invariant applies to every public entry point of the library that
decodes this encoded text, as well as to address objects. Decoding never raises
and never rejects a value: for any header text the call returns text with its
literal characters preserved.

## Keep working

Everything that works today keeps working exactly as today. In particular:

- a well-formed encoded word still decodes to the same text it does today,
  including a word whose payload contains characters that are not part of any
  marker;
- a word whose charset name is unknown still returns its payload, and an empty
  encoded word still decodes to an empty string;
- text without any encoded word is returned unchanged;
- adjacent encoded words are still joined with the white-space between them
  dropped, while literal text around them is kept;
- a display name that mixes literal text and several encoded words still
  decodes in order, and an ordinary address still parses to the same mailbox.

These are examples, not the full set of inputs.

## Constraints

- Fix the problem and its close variants everywhere the library reports or
  decodes this text.
- Keep legitimate use working; do not make decoding reject, refuse or crash on
  input.
- Do not look up the upstream fix or advisory.
- Do not special-case the example.
