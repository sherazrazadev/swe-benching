# FAIRNESS — ts-stack-s4

Covering sentences quoted below: **P** = "No output may appear in a transaction this library signs, or in a transaction it prepares for signing, unless it is exactly an output the caller requested (same locking script, same amount), or the caller's own change, or at most one service charge that is small relative to the action." **Q** = "This holds however the storage response labels, orders, separates or counts that data, and even when the caller requested no outputs of its own." **R** = "no data supplied with the storage response may decide a recipient the caller did not choose." **L** = "Legitimate use is preserved exactly…". **M** = the legitimate-versus-attack-magnitude bullet.

## 1. Test-by-test fairness

| test (file::name) | asserts | covering sentence | could a correct fix fail? | risk |
|---|---|---|---|---|
| outputs.test.ts::refuses an extra recipient returned alongside the requested outputs | attacker output in an otherwise legitimate response is refused, nothing processed | P | no | low |
| outputs.test.ts::refuses an extra recipient labelled as change without the storage provider label | `providedBy:'you' purpose:'change'` extra refused | P ("the caller's own change") + R | no — a non-refusing re-derive variant is safe but breaks the stated refusal form | medium |
| outputs.test.ts::refuses an extra recipient labelled as a service charge without the storage provider label | `providedBy:'you' purpose:'storage-commission'`, 1000 sats, refused | P ("a service charge") + R | no — same caveat as above | medium |
| outputs.test.ts::refuses an extra recipient carrying an unrelated storage label | `providedBy:'storage' purpose:'basket-payout'` refused | P | no | low |
| outputs.test.ts::refuses an extra recipient with no provider label at all | `providedBy:undefined` refused | P | no | low |
| outputs.test.ts::refuses a second service charge | two 1000-sat charges refused | P ("at most one") | no | low |
| outputs.test.ts::refuses a service charge larger than a legitimate charge | 1e12-sat listed charge refused | P ("small") + M | no (any cap in [1000, 1e9) passes) | low |
| outputs.test.ts::refuses an extra recipient when several outputs were requested | extra among two echoed outputs refused | P | no | low |
| outputs.test.ts::refuses an extra recipient when output positions are randomised | extra at vout 0 refused | P + Q ("orders") | no | low |
| remix.test.ts::refuses an extra recipient in a remix-change action | zero-request action with change + extra refused | P + Q ("even when the caller requested no outputs") | no — second builder, but the property applies | medium |
| remix.test.ts::refuses an extra recipient listed before the change in a remix-change action | extra first refused | same | no | medium |
| remix.test.ts::refuses an extra recipient in a remix-change action with randomised positions | change + extra + charge refused | same + Q orders | no | medium |
| sidechannel.test.ts::refuses a separately returned service charge larger than a legitimate charge | 1e12 `serviceCharge` refused | P + Q ("separates") + M | no | low |
| sidechannel.test.ts::refuses a separately returned charge that is not labelled as a storage charge | `providedBy:'you'` separate 1000-sat charge refused | P + Q + R | no | medium |
| sidechannel.test.ts::refuses a separately returned charge next to a charge in the output list | listed + separate charge refused | P ("at most one") + Q | no | low |
| legit.test.ts::signs a requested output together with the caller change | requested script at output 0, change 9000, storage change script absent, processed once | L | no | low |
| legit.test.ts::derives the change script locally, ignoring the storage-supplied script | two different storage scripts give one derived change script | L + standard expert knowledge: change is the caller's own only if derived from the caller's keys | no | low |
| legit.test.ts::accepts a change output at any amount | 210,000,000-sat change signed | L ("whatever its amount") | no | low |
| legit.test.ts::signs one small service charge | 1000-sat charge included, processed | L + M | no | low |
| legit.test.ts::signs every requested output faithfully | both requested scripts present | L | no | low |
| legit.test.ts::preserves requested outputs when positions are randomised | change at vout 0 kept, requested output kept | L + Q ("orders") | no — a vout-keyed fix breaks, but contradicts "orders" | medium |
| legit.test.ts::signs a remix-change action that only carries change | zero-request action signed, change derived | L + "An action with no caller-requested outputs keeps working too." | no | medium |
| legit.test.ts::signs a remix-change action with one small service charge | 1000-sat charge included | same + M | no | medium |
| legit.test.ts::includes a small service charge returned outside the output list | 1000-sat separate charge included | L ("exactly as it is today") + Q ("separates") | no — dropping the separate charge fails, but that breaks "exactly as it is today" | medium |
| project::0 accepts faithfully echoed caller outputs (with trailing commission + change) | existing guard accepts | standard expert knowledge: do not regress the repo's visible guard test + L | no | low |
| project::1 accepts when there are no caller outputs | guard accepts change only | same | no | low |
| project::2 rejects a substituted recipient locking script | throws /lockingScript/ | P ("same locking script") | no | low |
| project::3 rejects an altered satoshi amount | throws /satoshis/ | P ("same amount") | no | low |
| project::4 rejects reclassifying a caller output as storage change | throws /providedBy/ | P + R | no | low |
| project::5 rejects when a caller output is missing from the storage response | throws /storage outputs/ | standard expert knowledge: a requested recipient must still be paid + L | no | low |
| project::6 verifies multiple caller outputs positionally | accepts both, rejects swapped script | P | no — only a fix that deletes/renames `verifyRequestedOutputsUnchanged` fails | low |

## 2. Leniency (non-blocking)

- T1: `purpose` accepted alone (miss-conjunction); caught by S2/S3.
- T2/T3: return early on an empty request (miss-zero) or guard only the main builder (miss-remix); caught by S10–S12.
- T4: `dcr.outputs` reconciled, `serviceCharge` appended unchecked (miss-sidechannel, published-only); caught by S13–S15.
- T5: provider fee trusted (miss-cap); caught by S7/S13.
- Substitution guard weakened; caught by P2–P6.
- Uncaught: cap in (~1e9, 1e12); `storage-commission`-only label; manager pass-through (unbuilt, signer-covered).

## 3. Hints

- "…however the storage response labels, orders, separates or counts that data, and even when the caller requested no outputs of its own" — variant list (T1/T4/shuffle/two-charge/zero-output).
- "Fix the problem and its close variants." — announces variants.
- "An action with no caller-requested outputs keeps working too." — flags zero-output.

## Required: generalize

- That sentence: "separates"/"counts" name the out-of-list channel and count rule; replace with "This holds whatever the storage response contains and however it presents it."
- "An action with no caller-requested outputs keeps working too." — operation-shaped, for T2/T3. Delete; "Legitimate use is preserved exactly" already covers it.

## 4. Realism

T1/T2/T5 are real upstream code. T3/T4 are plausible protocol drift, reachable via `Wallet.createAction`. The remix builder duplicates the main builder and pre-justifies skipping reconciliation — convenient, not contrived. Nothing looks planted.

## Quality to tighten

- Add a 1e9 attack charge and a ~10k legitimate charge; only "no cap" is excluded today.
- Use `service-charge` in one legitimate and one attack case.
- The project test is restored pristine: a correct refactor of `verifyRequestedOutputsUnchanged` (or its messages) that updates that test fails. Announce the restore, or assert via `createAction`.

## Verdict

READY. Any fix throwing on a disallowed output — builder or call site, before signing — passes; the harness accepts any `Error` and constrains no layer. Oracle, hardening, alternative-fix and blind score 1.0; each miss/published patch fails only its intended tests. Sole judgment: silent re-derivation (S2/S3) departs from the stated refusal form, so leniency, not unfairness. "separates" and the zero-output clause cover the siblings.

Human review: confirm S2/S3 require refusal of a change/charge-labelled output lacking `providedBy:'storage'`, not silent re-derivation.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
