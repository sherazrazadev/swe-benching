# Post-run audit: ts-stack-s4__nqgLMXp

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8667.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.8667 = 13/15 security and all functional tests passing (score.py:64). The model added one check in the signer that covers the substance of the stated property. Outputs that storage adds beyond the caller's must be either change, which is only accepted when providedBy='storage' and purpose='change' and whose script is re-derived locally, or a single bounded service charge. The check applies to the normal builder, the remix builder and the separately returned serviceCharge field, and it rejects extra, duplicated, oversized and repeated charges. Both failing tests are the build's 'miss-conjunction' lever applied to service charges: a single 1000-sat output labelled purpose='storage-commission' but providedBy='you' must be refused. The model recognises a service charge by its purpose label alone, so it accepts this output as the one allowed small charge. In money terms that output is identical to one the functional suite REQUIRES to be accepted. legit.test.ts:117-135 requires signing a single 1000-sat separately returned charge to the very same ATTACKER_SCRIPT, and the only difference is providedBy='storage'. The instruction allows 'at most one service charge that is small relative to the action' 'however the storage response labels ... that data' and says no storage-supplied data may decide a recipient. It never says a charge must carry a particular providedBy label, and providedBy is itself storage-supplied, so checking it adds no security. The build notes justify the label conjunction only for change, where the script is re-derived from the label (build-notes.md:23-32). For charges the script is always storage-chosen. A correct fix that judges outputs by count and amount rather than trusting labels fails these two tests. So the 2/15 deduction measures agreement with the reference's label check, not a security shortfall. The other 13 passes look real. The model's source diff could not be read directly because changes.patch was truncated to build artifacts (HARVEST.json truncated=true). Its behaviour is inferred from the transcript and from the compiled output it grepped, which is why confidence is medium.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| the storage response is reconciled with the caller request::refuses an extra recipient labelled as a service charge without the storage provider label | fail | test-fault | False | False |
| a service charge returned outside the output list::refuses a separately returned charge that is not labelled as a storage charge | fail | test-fault | False | False |

**Lookup or leak:** None found. The agent did not use the web: the only github.com strings in the transcript come from the ts-standard banner (transcript.md:180,210). At transcript.md:102 it searched the filesystem for recently modified test files and found only its own session logs, not evidence/tests. It read the in-repo regression test that names GHSA-36f9-7rg5-cpf8, which is part of the pinned tree. evidence/run.json shows no tool calls during the grading window, and there is no netguard log.

**Evidence:**
- evidence/grading/results.json:5,13 - the only two failures, both 'without the storage provider label'
- evidence/tests/security/outputs.test.ts:36-43 - extraOutput(1,{providedBy:'you',purpose:'storage-commission',satoshis:1000}) must be refused
- evidence/tests/security/sidechannel.test.ts:35-43 - separately returned charge with providedBy 'you', 1000 sats, must be refused
- evidence/tests/functional/legit.test.ts:117-135 - a separately returned 1000-sat charge to ATTACKER_SCRIPT with providedBy 'storage' must be signed
- evidence/tests/support/harness.ts:102-112 - extraOutput defaults to ATTACKER_SCRIPT, so the scripts in the failing and required-pass cases are the same
- evidence/instruction.md:32-38 - 'at most one service charge that is small relative to the action ... however the storage response labels ... no data supplied with the storage response may decide a recipient'
- evidence/build-notes.md:23-32 - the conjunction lever is justified by change-script re-derivation, which does not apply to charges
- evidence/solution/fix.patch:44-46,81-86 - the reference requires providedBy==='storage' for a charge
- evidence/transcript.md:257,268 - the model classifies a service charge with a purpose-only regex
- evidence/transcript.md:280-291 - the model's summary: change via the storage+change conjunction, at most one bounded charge, remix and serviceCharge paths covered
- evidence/final-code/HARVEST.json:10 - truncated=true; changes.patch contains only out/ build artifacts, so the source diff was not available
- evidence/run.json:19 - tool_calls_during_grading is empty

**Recommended action:** Do not report 0.8667 as a measure of a security shortfall: under the stated property the model's fix is effectively complete (15/15 in substance). Either remove the two 'without the storage provider label' charge tests, or change them so the mislabelled charge also breaks the property (for example a second charge or an oversized amount). Alternatively, state in the instruction that a service charge must be labelled as provided by storage. Then re-grade. Also fix the harvest so it keeps src/ diffs and does not truncate on build artifacts.
