# ts-stack-s4 — build notes

Start (UTC): 2026-10-29T05:25:14Z
End (UTC): 2026-10-29T05:50:40Z (patches stage; final gate stage)

## What the flaw is (one line)

A wallet action's outputs come back from the storage provider and are copied into
the transaction that is signed; at the pinned commit nothing reconciles the
*additional* outputs with what the caller asked for, so an extra recipient (or an
unbounded service charge) is signed and broadcast.

## Security property (stated once, in `instruction.md`)

Every output of any transaction the library signs, or prepares for signing, must
be either (a) an output the caller requested, unchanged in locking script and
amount, or (b) the caller's own change, or (c) at most one small service charge.
Nothing else may be included, however the storage response labels, separates,
orders or counts it, and even when the caller requested no outputs at all.

## Levers (each falls under that one property)

1. T1_change_commission_conjunction — HOW-type, real upstream code.
   `signer/methods/buildSignableTransaction.ts:60-64` plus the output labels.
   Change is safe only because the builder re-derives its script client-side
   (`makeChangeLock`), and that re-derivation is keyed on the conjunction
   `providedBy === 'storage' && purpose === 'change'`. A plausible fix that
   accepts `purpose === 'change'` alone, or a charge by purpose alone, signs an
   attacker script verbatim. Reason to skip: "change and a service charge are
   obviously not recipients; allow them by label." Coupled must-keep-working:
   legitimate change at any amount and one small charge stay signed. The
   randomised-`vout` shape is covered here too.

2. T2_zero_requested_outputs — HOW-type shape, real upstream code.
   A remix-change action has `args.outputs.length === 0`; a guard written as a
   loop over requested outputs inspects nothing. Reason to skip: "there is
   nothing requested, so there is nothing to check."

3. T3_remix_selfcheck — injected sibling (route where the protection never
   existed). `signer/methods/createAction.ts:87-90` sends remix-change actions
   to `buildRemixSignableTransaction.ts`, a dedicated builder that copies the
   storage output list verbatim (change still derived locally). Reachable
   through `Wallet.createAction` with no outputs and no inputs. Reason to skip:
   "remix actions carry no caller outputs; the transaction is just the change
   storage returns."

4. T4_separate_service_charge — injected sibling (route where the protection
   never existed). `StorageCreateActionResult` gains a `serviceCharge` field
   (`sdk/WalletStorage.interfaces.ts:256`); `createAction.ts:92-100` appends it
   to the transaction before signing with no count or size bound. Reason to
   skip: "the charge is a separate provider-declared field, not the output list
   that needed reconciling." Coupled: a small separately-returned charge still
   works.

5. T5_commission_cap — real upstream code. The single allowed charge is
   unbounded, so a large charge is an attacker output in disguise. Reason to
   skip: "the charge is the provider's own configured fee; trust the amount."

## Candidate list (every sibling site/route found, and why picks won)

Real upstream (read at the pin; `git show`/grep over
`packages/wallet/wallet-toolbox`):

- R1 `WalletPermissionsManager.createAction` 7a verifies only that requested
  outputs are present, never that extras are absent (screener O8 lead).
  Confirmed behaviourally: a stubbed underlying wallet's signable transaction
  with an extra recipient is returned and `signAction` is called. **Not built**:
  the wrapper receives only `(args, tx)` — no storage labels and no change
  derivation data — so it cannot distinguish a client-derived change output from
  an injected recipient. Any wrapper-only rule either rejects legitimate change
  or cannot detect the injection. The published fix never touched it, and the
  screener's own reason-to-dismiss agrees. Building on it would be unfair.
- R2 `WalletPermissionsManager.createAction` early return when no
  signableTransaction (screener O8 lead). **Not built**: on that path the
  underlying wallet has already signed and processed; the wrapper cannot undo
  the broadcast.
- R3 `StorageClientBase.createAction` / `StorageClient` / `StorageMobile` pass
  the remote result through unreconciled (screener O8b lead). **Not built**:
  not a signing sink; requiring reconciliation there is defence-in-depth whose
  absence is invisible once the signer is fixed, and a test would force one
  layer rather than the property.
- R4 `WalletStorageManager.createAction` pass-through. Same as R3.
- R5 `storage/methods/createAction.ts` honest handler builds both sides.
  Server-side producer; not reachable without a DB-backed provider and not the
  sink.
- R6 `CWIStyleWalletManager` and the higher-level permission-token helpers in
  `WalletPermissionsManager` consume `signableTransaction` but create through
  `wallet.createAction`, so the signer guard already covers them.
- R7 `Wallet.signAction` out-of-session recovery (throws
  `WERR_NOT_IMPLEMENTED` at the pin). No route exists at the pin.

Injected sibling candidates:

- S1 remix-change dedicated builder bypassing reconciliation — **picked** (T3).
- S2 separately-returned service charge appended after the builder — **picked**
  (T4); different mechanism (side channel, not a second builder) and different
  dismissal.
- S3 remix synthesises `args.outputs` from the storage response (self-reference)
  — rejected: the existing substitution guard rejects any output storage labels
  as change, so a legitimate remix would always throw.
- S4 a P-module `onResponse` transform that appends outputs — rejected: the
  attacker is application code, outside the storage threat model.
- S5 out-of-session recovery rebuilding from a persisted action — rejected:
  needs a new server-side storage method (DB) and is not reachable at the pin.
- S6 post-signature output repair — rejected: appending after signing
  invalidates the signatures.
- S7 provider-specific "basket payout" list — same mechanism as S2; the rules
  forbid more routes of one concept.
- S8 a client-side mapper that relabels `providedBy`/`purpose` — rejected:
  read-through shows the builder and any correct guard use the labels
  sympathetically (accepting change always implies re-deriving its script
  client-side), so relabelling cannot redirect funds.

## Sites / routes / shapes the security tests cover

15 security testcases: extra recipient on an ordinary action; extra labelled
change without the storage label; extra labelled charge without the storage
label; extra with an unrelated storage label; extra with no label; two charges;
charge over the bound; extra among several requested outputs; randomised output
positions with an extra; three remix-change shapes; three separately-returned
charge shapes.

## Coupled must-keep-working (functional tests)

9 hidden functional testcases plus the project's own 7:
requested output + locally derived change (proved by two runs with different
storage scripts yielding the same signed change script); change at any amount;
one small charge; multiple requested outputs; randomised positions; remix with
change only; remix with a small charge; a small separately-returned charge.

## Verified

- Toolchain: Node 22 host, pnpm 10.33.2, filtered install; the workspace override
  resolves `@bsv/sdk` to published 2.1.3, so no SDK build is needed. The
  project's verify test passes 7/7.
- Flaw reproduces at the pin through `Wallet.createAction` with a stub storage
  provider: an extra recipient is accepted and `processAction` is called; a
  legitimate change output is re-derived client-side.
- Pinned+injected tree: security 0/15 pass (each failure is "the action was not
  refused"), functional 9/9.
- oracle: 15/15 + 9/9. alternative-fix: 15/15 + 9/9. hardening: 15/15 + 9/9.
- published-only: security 9/15 (six remix/charge tests fail), functional 9/9.
- miss-conjunction 13/15; miss-zero 12/15; miss-cap 13/15; miss-remix 12/15;
  miss-sidechannel 12/15; over-broad 0/9 functional; refuse-all 0/9 functional.
- All patches apply cleanly to the pinned+injected tree with `patch -p1`.

## Gate results

- static PASS.
- nop PASS: security 0/15 pass on the pinned+injected tree (every failure was "the action
  was not refused"), functional 16/16 pass.
- oracle PASS 3/3: reward 1.0, 15/15 security and 16/16 functional in each run, identical.
- patches PASS 10/10: published-only (6 security fail), miss-conjunction (2), miss-zero (3),
  miss-cap (2), miss-remix (3), miss-sidechannel (3) all leave functional green; over-broad and
  refuse-all break only functional; hardening and alternative-fix score 1.0. blind.patch is
  declared and left for the downstream blind-fix step.

## Could not verify / open

- Target-model trials were not run (forbidden by the build prompt); the gate
  proves the mechanics, not the 0/3 bar.
- The two screener O8 manager routes are real but were judged unfair to fix at
  the wrapper and were not built (R1/R2 above).
- The pinned tree already carries an upstream comment and unit test naming the
  advisory id for the *substitution* half of the same fix. The instruction forbids
  looking up the upstream fix, but a solver could still search the id.

## Out of scope (noted, not built on)

- Storage-side (database handler) output construction and wallet sync paths were
  read but are not the client signing sink.
