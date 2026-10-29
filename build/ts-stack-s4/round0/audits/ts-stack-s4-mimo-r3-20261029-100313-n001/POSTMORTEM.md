# Post-run audit: ts-stack-s4__VhiErQW

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8667.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** high

Reward 0.8667: 13/15 security tests and all functional tests passed. Both failures come from one unstated requirement. A single 1000-sat unrequested output must be refused when it is labelled providedBy:'you' instead of providedBy:'storage'. The model's fix ignores labels when checking a service charge. It allows at most one unrequested, non-change output, capped at 3000 sats and at a share of the value spent, and accepts the change label only when the change script is re-derived locally. So it accepted a 1000-sat charge whatever its label. The instruction defines the allowed set by content only: requested outputs exactly, the caller's change, or 'at most one service charge that is small relative to the action'. It says this holds 'however the storage response labels' the data, and that a charge of about 1000 sats is legitimate. The label check also adds no security, because the label is set by the same untrusted storage provider. In the suite's own sidechannel test 3, a 1000-sat charge paying ATTACKER_SCRIPT with providedBy:'storage' counts as an acceptable single charge and is refused only for being a second one. The failing tests pay the same script and amount and differ only in the label. The reference fix passes only because it checks the label. A correct label-agnostic fix fails these two tests, so the score under-reports the model's work. No contamination found, and there were no harness or infra problems.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| the storage response is reconciled with the caller request::refuses an extra recipient labelled as a service charge without the storage provider label | fail | test-fault | False | False |
| a service charge returned outside the output list::refuses a separately returned charge that is not labelled as a storage charge | fail | test-fault | False | False |

**Lookup or leak:** None found. The transcript contains no WebFetch or WebSearch, no curl to a code host, and no access to hidden test paths (a grep for tests/, harness.ts, sidechannel, github and npmjs matched nothing). The agent ran only local git log/show. build-notes.md says the advisory ID appears in the pinned tree, but there is no sign the model looked it up.

**Evidence:**
- evidence/instruction.md:32-38 - property defined by content: 'exactly an output the caller requested ... or the caller's own change, or at most one service charge that is small relative to the action. This holds however the storage response labels, orders, separates or counts that data'
- evidence/instruction.md:50-51 - 'A service charge on the order of a thousand satoshis is legitimate.'
- evidence/tests/security/outputs.test.ts:36-43 - fails: extraOutput(1, { providedBy: 'you', purpose: 'storage-commission', satoshis: 1000 }) must be refused
- evidence/tests/security/sidechannel.test.ts:35-43 - fails: serviceCharge: extraOutput(2, { providedBy: 'you', purpose: 'storage-commission', satoshis: 1000 }) must be refused
- evidence/tests/security/sidechannel.test.ts:45-62 - a 1000-sat charge to ATTACKER_SCRIPT labelled providedBy:'storage' is refused only for being a second charge, so the same recipient and amount is an acceptable single charge when the label says 'storage'
- evidence/tests/support/harness.ts:102-112 - extraOutput pays ATTACKER_SCRIPT; only the label separates the failing cases from an accepted charge
- evidence/solution/fix.patch:44-46,81-86 - reference accepts a commission only if providedBy === 'storage' && purpose in {storage-commission, service-charge}, a label check
- evidence/final-code/changes.patch:918 - model treats an output as change only when providedBy==='storage' && purpose==='change' (the conjunction that triggers local script re-derivation), so the change lever is handled correctly
- evidence/final-code/changes.patch:950-964 - model caps the charge at 3000 sats and at max(1000, 10% of value spent)
- evidence/build-notes.md:23-32 - lever T1 says accepting 'a charge by purpose alone' signs an attacker script verbatim, but a charge's script is always storage-supplied, so adding providedBy==='storage' prevents nothing an attacker cannot simply relabel
- evidence/grading/results.json:5,13 - the only two failures; all 49 functional tests pass
- evidence/run.json:12-19 - no tool calls during the grading window, no exception_info

**Recommended action:** Do not report 0.8667 as the model's score. Fix the task: either drop the two 'without the storage provider label' tests, or change them to use an amount or count the instruction actually forbids. If the label check is meant to be part of the spec, the instruction must say so, which would contradict 'however the storage response labels'. Then re-grade this trial. On the evidence here it would very likely score 1.0 (model-solved). Also check the other ts-stack-s4 trials for the same two failures.
