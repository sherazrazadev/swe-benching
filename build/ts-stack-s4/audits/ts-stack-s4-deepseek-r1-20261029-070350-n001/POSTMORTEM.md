# Post-run audit: ts-stack-s4__DHYcEPW

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8667.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

The model's fix implements the stated property: requested outputs are matched by position, extras must be storage change (providedBy='storage' AND purpose='change', script re-derived locally) or at most one service charge across the list and the separate field, and that charge is capped (100k absolute, plus <=1000 sats or <=1/10 of the spend). It covers the main builder, the remix builder and the separate serviceCharge side channel, and it validates before processAction. 13/15 security and 42/42 functional tests pass. Both failures send ONE 1000-sat charge labelled purpose='storage-commission' but providedBy='you', with no other charge. The model chose on purpose to identify a charge by its purpose alone (transcript.md:239-241, 'relaxing charge label requirement'; code comment: 'providedBy is not part of that guarantee'). Under that rule the output is accepted as the single small charge allowed. The instruction never says a service charge must carry providedBy='storage'. It says the property holds 'however the storage response labels' the data. And the label makes no security difference: storage writes both the label and the charge's script, and a real charge's script is signed exactly as storage returned it, so an attacker gets the same 1000 sats by writing providedBy='storage'. The build notes say a charge accepted 'by purpose alone signs an attacker script verbatim', but the oracle signs the storage-chosen charge script verbatim too. These tests enforce a label convention, not the property, so a correct label-agnostic fix fails them. The 0.8667 understates the model's work.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| the storage response is reconciled with the caller request::refuses an extra recipient labelled as a service charge without the storage provider label | fail | test-fault | False | False |
| a service charge returned outside the output list::refuses a separately returned charge that is not labelled as a storage charge | fail | test-fault | False | False |

**Lookup or leak:** None found. The agent read only in-repo source and the project's existing tests (for example buildSignableTransaction.verify.test.ts and WalletPermissionsManager.outputVerification.test.ts). It never touched evidence/tests or the hidden harness. It ran no web, curl or registry lookups for the advisory; its GHSA grep was over local source only (transcript.md:15, 55). No tool calls fell inside the grading window (run.json timing.tool_calls_during_grading=[]).

**Evidence:**
- instruction.md:32-38 - 'at most one service charge that is small relative to the action. This holds however the storage response labels, orders, separates or counts that data'
- instruction.md:42-52 - the contracts name the refusal form, legitimate use and charge magnitude; none requires a providedBy label on the charge
- tests/security/outputs.test.ts:36-43 - extraOutput(1, { providedBy: 'you', purpose: 'storage-commission', satoshis: 1000 }) must be refused
- tests/security/sidechannel.test.ts:35-43 - separate serviceCharge with providedBy 'you', 1000 sats must be refused
- solution/fix.patch:44-45, 81-86 - the oracle requires providedBy === 'storage' for a charge but signs the storage-chosen charge script verbatim, so the label check adds no protection
- build-notes.md:23-32 - the T1 rationale claims accepting a charge 'by purpose alone signs an attacker script verbatim', which is equally true of any legitimate charge
- final-code/changes.patch:624-629 - model: 'The label alone identifies the single service-charge exception... providedBy is not part of that guarantee'
- final-code/changes.patch:787-818, 883-891 - count and amount bounds enforced on in-list and separate charges
- transcript.md:239-241 - the model deliberately relaxed the providedBy requirement on charges
- grading/results.json - 13/15 security, all functional pass; test-stdout.tail.txt is empty, but results.json is complete
- run.json - no exception_info and no tool calls during the grading window

**Recommended action:** Treat this trial as a substantial solve that was under-scored by test fault, not as a model shortfall. Fix the task in one of two ways. (a) Drop or rewrite the two 'without the storage provider label' charge tests so they check the property: for example, a providedBy='you' charge alongside a real charge, or one over the bound. (b) Explicitly state in instruction.md that a service charge must be labelled providedBy='storage' and that out-of-region outputs labelled as caller-provided are refused. Then re-grade.
