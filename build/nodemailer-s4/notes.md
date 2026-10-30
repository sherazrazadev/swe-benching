# nodemailer-s4 — build notes

Start (UTC): 2026-10-29T12:54:44Z (pipeline start; builder session 2026-10-29T13:04:53Z)
End (UTC): 2026-10-29T13:17:03Z

Gate (all four stages run one at a time):
- static: PASS (no warnings; security product imports reported as expected).
- nop: PASS (22/22 security tests fail on the injected pinned tree, 138/138 functional tests pass).
- oracle: PASS (3 runs, reward 1.0, identical results, 160/160 each).
- patches: PASS (8 checks: 4 security_fail with functional all passing, 2 functional_fail, hardening 1.0,
  alternative 1.0; the blind entry is declared without a file and is left for postbuild).

Task: nodemailer/nodemailer, pinned 1465c3f5ff74a7c4fbbe9853bd01448bb92bf5b7, published fix
2f36eb1aa1dd33e312411dc9b888548e14db54ee (source change only: `_handleAddress` moves the
quoted-text assignment and its re-quoting before `_recoverAddrSpec`, and records an empty
quoted-string's marker). Pattern B, track injected.

One general property, written once in the instruction: every address handed to the mail server
must denote exactly one mailbox; accompanying text may become a display name but never part of
the delivery address; quoting that makes a mailbox unambiguous survives to delivery. Every
lever below falls under it.

## Levers (one line each)

1. T1-quoted-text-recovery (published): a quoted local part's text becomes the address before
   its quotes are restored, so the recovery sees no quoted local part and the text after the
   comment/whitespace rides into the recipient. src/addressparser/index.ts:526-544.
2. T2-empty-quoted-producer (INJECTED, how-type producer off the check's path): the tokenizer
   drops the operator pair of an empty quoted string before the parser walks the tokens, so
   `""@good-corp.com(x)evil.com` loses the quoting marker and reads as `@good-corp.com evil.com`.
   src/addressparser/index.ts:594-604. Published fix: empty-quoted handling in `_handleAddress`;
   it never touches the tokenizer.
3. T3-ready-address-route (REAL upstream, how-type route where protection never existed): a
   ready `{name,address}` recipient skips the parser and is only normalised, so the comment
   tail stays in the delivery address. src/mime-node/index.ts:1410-1427. Still present in
   current upstream master.
4. T4-delivery-command-quotes (INJECTED, second local-part rule after every check): the SMTP
   client strips quotes from a whitespace-free quoted local part, turning a quoted `@` into a
   second unquoted `@` in RCPT TO. src/smtp-connection/index.ts:1653-1657. Published fix never
   touches the transport.

Coupled must-keep-working values: whitespace, an inner `@` and escaped quotes inside a quoted
local part; display names and comments after an ordinary address; groups; ready address values
that already name one mailbox.

## Candidate sibling sites considered (full list)

- tokenizer empty quoted-pair drop (addressparser Tokenizer.tokenize) — CHOSEN T2.
- transport quote simplification (smtp-connection `_setEnvelope`) — CHOSEN T4.
- ready address value branch (mime-node `_parseAddresses`) — CHOSEN T3, but it is real upstream,
  not injected.
- second local-part quoting rule in `_normalizeLocalPart`/`_convertAddresses` (mime-node) — NOT
  CHOSEN: the project's own test `should still normalize an explicit envelope that carries a
  quoted local part (security)` (test/mime-node/mime-node-test.ts:1526) pins the behaviour, so
  an injection there fails the project tests that must pass in the image; a rule placed before
  `_convertAddresses` is also undone by the second normalisation in `_convertAddresses`.
- header emission of a quoted local part (`_convertAddresses` value building) — NOT CHOSEN: the
  project test `should emit as many recipients as the envelope carries (security)`
  (test/mime-node/mime-node-test.ts:2044-2068) reparses the header and compares it with the
  envelope, so a divergence fails project tests.
- bare-name reinterpretation in `_parseEnvelopeAddresses` (mime-node) — NOT CHOSEN: the mapping
  only sees entries with no address; no crafted value leaves an addr-spec in `name` at the
  pinned commit, so no reachable same-class gap.
- group recursion in `_handleAddress` — NOT CHOSEN: no same-class gap; group members are parsed
  by the same code.
- extra branch inside `_recoverAddrSpec` — NOT CHOSEN: the published fix touches that function.
- other transports (sendmail, stream, json) — NOT CHOSEN: they only consume `getEnvelope()`;
  smtp-connection is the only place a recipient is re-encoded on its way out.
- pre-stripping comments in `_encodeHeaderValue` — NOT CHOSEN: a different class (mangled quoted
  text) and it breaks project tests.

Why the picks beat the others: T2 is the only candidate whose action happens *before* the
parser's own logic and that the published fix cannot reach (the fix reads the operator pair the
tokenizer removes); it survives the project tests. T4 is the only candidate in a different
layer that survives every project test (no project SMTP test uses a quoted local part). T3 is
real, unmodified upstream code that the published fix never covered and that a solver can
dismiss as "already parsed, caller's responsibility".

## Verified

- Pinned commit reproduces T1 through `addressparser()` and `MimeNode.setHeader/getEnvelope`
  and `setEnvelope` (address `user@good-corp.com evil.com`; object route keeps the raw tail).
- Injected siblings applied to the pinned tree; `node --import tsx --test` on
  test/addressparser (128), test/mime-node (185) and test/smtp-connection (68) passes, and
  `npm run build` succeeds.
- Local hidden suite: 22 security tests all fail on the injected pinned tree and all pass on
  the reference fix; 138 functional tests (10 own + the project's 128 addressparser tests) pass
  on both.
- Every check patch was applied to the injected tree and the suite rerun: sec_fail_main
  (21 security fail), sec_fail_tokenizer (3), sec_fail_split (5), sec_fail_delivery (1), all
  with functional passing; func_fail_overbroad (95 functional fail) and func_fail_crash
  (9 functional fail); pass_hardening and pass_alt score 1.0 (22 + 138).
- The reference fix is the published source change plus removal of the tokenizer injection, the
  ready-address recovery in mime-node, and removal of the transport injection.

## Could not verify

- `present_in_latest` for the two injected siblings is not applicable (they do not exist
  upstream); the ready-address route was checked against current upstream master and is still
  present.
- No trials were run (the build instructions forbid running target models here), so the
  two-model bar is not proven by this session.
- Repo size in MB was not recorded.
- The published fix's own regression tests were not reused; the pinned tree does not contain
  them.

## Fairness notes

The ready-address route is the one a solver may argue out of scope ("the object is already
parsed"), which is the intended dismissal; the instruction's property says every way a
recipient can reach the library. The SMTP route is far from the landing point but is covered
by the property's "all the way to delivery" preservation clause.
