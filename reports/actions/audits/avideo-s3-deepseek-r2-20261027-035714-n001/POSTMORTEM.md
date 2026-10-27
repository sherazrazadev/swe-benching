# Post-run audit: avideo-s3__3Y9TR98

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

All 7 security tests pass. All 6 functional failures have one cause: the hidden tests sign notifications with HMAC-SHA512 keyed by the raw ASCII signature key, but the repo's existing verifySignature hex-decodes the key (hex2bin). The model correctly made the signature check mandatory and kept the repo's hex scheme, so every genuinely signed test notification was rejected with 401. The instruction never says the key handling is wrong or which HMAC keying counts as 'correctly authenticated with the configured key'. The build notes admit this is a hidden lever ('the pinned code hex-decodes the key, so a correct fix must fix both the gate and the key handling'). Apart from that, the model's fix takes account, amount and approval from the provider record and looks correct, so the 0.0 measures undisclosed provider domain knowledge rather than the security fix.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FuncNotificationTest::testGenuineNotificationCreditsTheGatewayPayment | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithCamelCaseStatusCredits | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuinePaymentForAnotherAccountCreditsThatAccount | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testCorrectlySignedRecurringNotificationCredits | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testRecurringNotificationCreditsItsOwnAccount | fail | instruction-ambiguity | False | False |
| SecNotificationTest::testAuthenticNotificationCannotChooseAnotherAccountOrAmount | pass | lenient-test | True | True |

**Lookup or leak:** None found. The agent read only the repo's own /workspace/tests (unrelated existing PHPUnit tests), never the hidden suites. Its only curl calls went to its own local PHP server at 127.0.0.1:8765. There was no web or upstream lookup.

**Evidence:**
- grading/results.json: all 7 security tests pass; the 4 FuncNotificationTest genuine-credit tests and both FuncRecurringTest tests fail; reward 0.0
- tests/support/AnetHarness.php:175-179 'HMAC-SHA512 over the raw body, keyed with the configured signature key as sent' -> hash_hmac('sha512', $rawBody, $signatureKey)
- solution/fix.patch:27-35 the reference fix replaces hex2bin($signatureKeyHex) with the raw key ('The Signature Key is used as a raw ASCII string in the HMAC — not hex-decoded')
- build-notes.md:98-100 'Genuine notifications signed with the raw configured key still verify (the pinned code hex-decodes the key, so a correct fix must fix both the gate and the key handling)'; build-notes.md:153 'ff-hexkey' check is designed to break functional tests
- instruction.md: says only 'A notification that is correctly authenticated with the configured key still credits its payment'; there is no mention of key encoding or of the existing verifier being wrong
- final-code/changes.patch:348-360 the model keeps the ctype_xdigit/hex-decoded key path and only makes header lookup case-insensitive; changes.patch:185-190 and 106-111 make the signature mandatory (401) in webhook.php and webhookSubscription.php
- transcript.md:247 the model's own e2e check used a hex KEY with the existing scheme: forged/no-sig -> 401, signed forged values -> credited provider users_id=7 amount=5
- run.json: tool_calls_during_grading empty and no exception, so there was no harness or timeout issue

**Recommended action:** Do not count this 0.0 as a model failure. Either say in the instruction that the configured signature key is used as-is (not hex-decoded) for the notification HMAC, matching the provider, or accept both keyings in the functional tests. Then re-run. With that one change, the model's fix appears likely to score 1.0.
