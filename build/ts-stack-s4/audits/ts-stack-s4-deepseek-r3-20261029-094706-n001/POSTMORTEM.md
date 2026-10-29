# Post-run audit: ts-stack-s4__9MW5CZx

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8667.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.8667 = 13/15 security tests, with all functional tests passing. The model's fix is substantive and catches every attack variant that changes who is paid or how much: extra recipients, relabelled change, a second charge, oversized or proportional charges, charges returned in the separate serviceCharge field, remix-change actions and randomised vouts. Both failing tests use the same input: one 1000-sat output to ATTACKER_SCRIPT with purpose 'storage-commission' but providedBy 'you', placed either in outputs or in the serviceCharge field. The model deliberately decides what counts as a service charge from the purpose label alone, not from providedBy. It then limits the charge by count (at most one) and size (at most 100k sat and 10% of value), so this is accepted as the single legitimate charge. The tests require a providedBy==='storage' label check. The instruction never states that requirement, and its 'however the storage response labels' wording points toward label-agnostic rules. The check also adds no security: the reference fix and these tests accept the same 1000-sat charge to the same ATTACKER_SCRIPT once it carries providedBy:'storage' (sidechannel.test.ts:45-61 refuses that output only because it is a second charge). So a reasonable, correct fix that bounds charges by count and size, as the instruction asks, fails these two tests. The lost 0.13 reflects one specific reference implementation, not a security gap in the model's work. Harness quirk: the functional group also runs the model's own test file in src/signer/methods/__tests. It passed, so the reward was not affected. No contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| the storage response is reconciled with the caller request::refuses an extra recipient labelled as a service charge without the storage provider label | fail | test-fault | False | False |
| a service charge returned outside the output list::refuses a separately returned charge that is not labelled as a storage charge | fail | test-fault | False | False |

**Lookup or leak:** None found. The transcript's GHSA-36f9 references come from existing in-repo code and tests (buildSignableTransaction.verify.test.ts and comments), which the agent found with grep (transcript.md:28-33). There are no web fetches, no reads of /tests or htests, and no netguard log. run.json shows no tool calls during the grading window.

**Evidence:**
- instruction.md:32-38: 'at most one service charge that is small relative to the action. This holds however the storage response labels, orders, separates or counts that data'. Nothing requires a providedBy==='storage' label
- tests/security/outputs.test.ts:36-43: extraOutput(1, { providedBy: 'you', purpose: 'storage-commission', satoshis: 1000 }) expected to be refused
- tests/security/sidechannel.test.ts:35-43: separate serviceCharge with providedBy 'you', purpose 'storage-commission', 1000 sat expected to be refused
- tests/security/sidechannel.test.ts:45-61 and tests/support/harness.ts:13: a providedBy 'storage' 1000-sat charge to ATTACKER_SCRIPT is refused only because it is a second charge, so the same recipient and amount pass when labelled 'storage'
- solution/fix.patch:44-45,81-86: the reference recognises a commission only when providedBy === 'storage'
- final-code/changes.patch:610-612: model comment 'Labels are not trusted to make an output safe: change is re-derived from the caller's key, and a service charge is counted and bounded below'
- final-code/changes.patch:630-635,645-655: purpose-only classification for in-list and separate service charges
- final-code/changes.patch:657-687: single-charge count, 100k absolute cap and 10% relative cap
- grading/results.json:5,13: the two failures; all other 13 security tests and all functional tests pass
- tests/test.sh:108: the functional group pattern includes src/signer/methods/__tests, so the model's own added tests were graded as functional (all passed)
- run.json timing: tool_calls_during_grading is empty

**Recommended action:** Do not treat the 0.8667 as a model shortfall. Either drop or rework the two providedBy-label tests, or state in the instruction that a service charge must carry the storage provider's label. Then regrade. Under a label-agnostic reading the model's fix satisfies the stated property, so the score would be 1.0. Separately, exclude agent-written files from the functional glob (src/signer/methods/__tests) so a model's own failing test cannot zero the reward.
