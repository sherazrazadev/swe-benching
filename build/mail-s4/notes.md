# mail-s4 build notes

- Start (UTC): 2026-10-30T00:14:44Z
- End (UTC): 2026-10-30T00:50:30Z
- Task: `tasks/mail-s4`; build record: `build/mail-s4`.
- Advisory: GHSA-MVXR-6M87-MV2Q / CVE-2026-63435 (mikel/mail, RFC 2047 encoded-word decoding of
  an address local part).
- Pinned: d1d65b370b109b98e673a934e8b70a0c1f58cc59 (direct parent of the published fix
  f9d59c2e447af42e2c3dec5a56b1bb25c7292859). The pinned tree does not contain the fix's
  regression specs.
- Pattern A, injected track. One shared property, five security levers, 14 security tests,
  12 hidden functional tests plus the project's own specs for the affected area.

## The levers (one line each)

1. **T1 - reported site, how-type boundary.** `lib/mail/utilities.rb:436-453` (`q_value_decode`):
   the greedy charset capture re-splits a malformed word, so `=?UTF-8?Q?spoof?Q?agent?=` becomes
   `agent`. Reason to dismiss: none, every solver fixes it.
2. **T2 - second implementation.** `lib/mail/utilities.rb:418-429` (`b_value_decode`) has its own
   copy of the same boundary rule 18 lines away. Reason to dismiss: the report's example is
   Q-encoded.
3. **T3 - shape a plausible check mishandles (how-type).** Both decoders must decode *every* word
   in a value and keep literal text; a single-match rewrite (`match` + greedy payload) keeps the
   single-word example working but drops the leading word and literal text of a mixed value.
   Reason to dismiss: the example is one word.
4. **T4 - injected sibling I1, single-phrase decoder for display names.**
   `lib/mail/encodings.rb:142-148` (`value_decode_phrase`, called from `Address#display_name`,
   `lib/mail/elements/address.rb:87-97`). Its own greedy split, so fixing the published decoders
   leaves a malformed display name collapsed to the short name. Reason to dismiss: encoded words
   in a display name are the feature's legitimate home.
5. **T5 - injected sibling I2, single-word decoder for domains.**
   `lib/mail/encodings.rb:150-156` (`value_decode_domain`, called from `Address#domain`,
   `lib/mail/elements/address.rb:123-129`). Same mechanism for a whole encoded domain. Reason to
   dismiss: the report names the local part; a domain is a different part of the address.

Coupled must-keep-working behaviour (functional tests, pass on the pinned tree): legitimate Q/B
decoding, a Q payload containing an unencoded `?` (`=?UTF-8?Q?what?is?=` -> `what?is`), unknown
charset still returning the payload (`=?BAD-ENCODING?B?VEVTVA==?=` -> `TEST`), empty word -> `""`,
adjacent words joined without separating whitespace, mixed literal+encoded values, plain text, and
the project's own encodings/utilities/address-list/common-address specs.

## Injected siblings: full candidate list and why the two picks won

Search of the pinned tree (`lib/`) for every other place that touches encoded-word text found one
decode implementation (`Utilities.q/b_value_decode`, reached only through `Encodings.value_decode`).
Candidates considered for injected siblings:

1. `Utilities.param_decode` (RFC 2231, `utilities.rb:455-462`) - lenient decode, but it decodes
   parameters (filenames), not addresses; the property could not cover it without a second
   protection, and it sits in the file the published fix edits. Rejected.
2. `Constants::ENCODED_VALUE` / `FULL_ENCODED_VALUE` (`constants.rb:39-59`) - tightening or
   loosening the matcher does not create an independent decision: the fixed decoders re-scan the
   span they are given, so no version of this change reproduces the flaw after the fix. Rejected.
3. `Encodings.collapse_adjacent_encodings` (`encodings.rb:258-276`) - only whitespace splitting
   between already-matched words; the payload decode still runs in the fixed decoders, and a
   plausible version that drops non-blank literal text is not a change a maintainer would leave.
   Rejected.
4. `Encodings::QuotedPrintable.decode` (`encodings/quoted_printable.rb:18-20`) - receives only the
   payload the decoder already split, so it cannot move the boundary; a "lenient mode" that
   re-splits at `?` is not plausible. Rejected.
5. Inline split in `Address#local` (`address.rb:113-116`) - the landing point the report leads to;
   too easy, and it duplicates the published route. Rejected.
6. **Single-phrase decoder for display names** - picked (I1). Moved behind a plausible helper in
   `encodings.rb` so the buggy code is not in the file the report leads to; the call site in
   `address.rb` reads as ordinary delegation.
7. **Single-word decoder for domains** - picked (I2). Same placement; a different address part
   with a different dismissal reason.
8. A new `Utilities.decode_encoded_word` helper next to the fixed pair - rejected: same file,
   adjacent lines, found by anyone who greps the decoders.
9. `CommonAddressField` address-string builder - rejected: it delegates to `Address`; an
   independent decode there would be invented rather than plausible.
10. Generated racc parser (`address_lists_parser.rb` / `.rl`) - rejected: hand-editing generated
    output is not a change a maintainer leaves, and the `.rl` source would disagree.
11. `Message#filename` (`message.rb:2141`) - rejected: attachment filenames are a different
    protection the advisory does not cover.
12. `Encodings.unquote_and_convert_to` - rejected: it delegates to `value_decode`, i.e. the same
    sink; a pre-pass there is unnatural.

Both picks are reachable through the reported public API, are independent implementations (own
charset/payload split, so fixing the published decoders changes nothing for them), and carry
different reasons a solver skips them. That is why they were chosen over the where-type or
same-file candidates above.

## What was verified

- Reproduced on the pinned tree offline (Ruby 3.2, `ruby -Ilib`): for
  `"John Doe" <=?UTF-8?Q?spoof?Q?agent?=@example.com>` `Mail::Address#address` is
  `agent@example.com`; the B form, the domain form, the display-name form, a group member, a
  `From` field and a `To` field behave the same; direct `q_value_decode`/`b_value_decode` return
  `agent` for a malformed word and swallow literal text on a mixed value
  (`=?UTF-8?Q?a?= literal =?UTF-8?Q?b?=` -> `b`).
- The reference fix (`solution/fix.patch`) keeps the literal text for every one of those
  (`spoof?Q?agent`, or the whole word left literal for B), decodes mixed values to `a literal b`,
  and leaves the coupled legitimate values unchanged.
- The project's four specs for the affected area pass on the pinned tree, on the pinned+injected
  tree and on the reference fix: 274 examples, 0 failures, 2 pending.
- Local verifier simulation (both images built, `test.sh` run in the verifier image as uid-1000
  agent): nop reward 0.0 with 14/14 security failing and 13/13 functional passing; oracle 1.0;
  every check patch behaved as declared.
- Gate, one stage at a time: static PASS, nop PASS, oracle PASS (3 runs, 1.0, identical),
  patches PASS (9/9). A full `gate.py mail-s4` run over all four stages then passed too
  (`build/mail-s4/gate_report.json`, verdict pass, 2026-10-30T00:44Z-00:50Z).
- Pattern B register: no rows. Every unmodified-upstream route to the sink at the pinned commit
  goes through `Utilities.q/b_value_decode` (via `Encodings.value_decode`), which the published
  fix covers, so there is no real upstream uncovered route to record; the two additional sites
  are injected, not upstream.

## What could not be verified / unknowns

- No target-model trial was run (the brief forbids it), so the bar against DeepSeek V4.1 Flash and
  MiMo-V2.6-Pro is unmeasured here.
- `blind.patch` is declared in the manifest but not written; the pipeline's blind-fix step produces
  it. Static accepts the declaration and patches skips a missing blind file.
- The display-name sibling's fairness rests on the instruction's property over "every piece of
  text it reports for that address"; a reader who treats display names as out of scope will miss
  it. That is the intended scope lever, not an ambiguity in the property.
- The indirect `Utilities` entry points are covered by the instruction's "every public entry
  point" clause; a solver who fixes only `Encodings.value_decode` and leaves the word decoders
  single-match fails T3.
- No upstream "present_in_latest" check was needed (no Pattern B route).
