# Post-run audit: avideo-s3__kdnWwZp

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Grading ran cleanly: all 7 security tests passed and 7 of 9 functional tests failed, so the reward is 0. Two separate regressions in the model's own fix cause the failures. (1) The model routed approval in every handler through getTransactionDetails()['isApproved']. That function compares the status case-sensitively ('settledSuccessfully'), while the existing analyser lowercases it, so a settled transaction that the provider reports in lower case is now refused as 'not approved'. That breaks a legacy post the pinned code accepts today. FuncLegacyPostTest::testMatchingLegacyPostCreditsThePayment fails for this reason alone, and the instruction states this requirement explicitly ('A payment the provider reports as settled is still credited', 'Every legitimate notification the integration accepts today is still accepted'). That failure alone forces reward 0. (2) The model made the signature a hard gate but kept the pinned verifier, which hex-decodes the configured key. Genuine notifications signed with the configured key as-is now get 401 on webhook.php and webhookSubscription.php. Raw-key HMAC is what the provider actually uses and what the upstream fix adopts. Still, the instruction never states the key encoding, so the three tests that fail only for this reason are partly an instruction-ambiguity concern. They do not change the outcome. There is no contamination: the agent read only the repo's own tests/ directory, never the hidden suites, and made no network lookups. The model never exercised a legitimate flow end to end; its only checks were PHP syntax checks.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FuncLegacyPostTest::testMatchingLegacyPostCreditsThePayment | fail | genuine-fail | True | True |
| FuncNotificationTest::testGenuineNotificationCreditsTheGatewayPayment | fail | genuine-fail | True | True |
| FuncNotificationTest::testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord | fail | genuine-fail | True | True |
| FuncNotificationTest::testGenuineNotificationWithCamelCaseStatusCredits | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuinePaymentForAnotherAccountCreditsThatAccount | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testCorrectlySignedRecurringNotificationCredits | fail | genuine-fail | True | True |
| FuncRecurringTest::testRecurringNotificationCreditsItsOwnAccount | fail | instruction-ambiguity | False | False |
| SecNotificationTest::testAuthenticNotificationCannotChooseAnotherAccountOrAmount | pass | lenient-test | True | True |
| SecNotificationTest::testDeclinedTransactionIsNotCredited | pass | lenient-test | True | True |

**Lookup or leak:** None found. The agent listed and read /workspace/tests (the repo's own PHPUnit suites: Security/*, Unit/*, TestCase.php, bootstrap.php), not the hidden suites, which test.sh copies into /workspace/.htests only at grade time. The transcript shows no web or git-remote access, and the agent network mode is no-network. No netguard.log is present.

**Evidence:**
- grading/results.json: all 7 security tests pass; functional failures are FuncLegacyPost::testMatching..., 4 of 5 FuncNotification tests and both FuncRecurring tests; reward 0.0
- run.json: tool_calls_during_grading=[], agent_events_after_end=0, exception_info=null
- final-code/changes.patch:335-338 silentPost: `if (empty($trusted['isApproved'])) { echo 'not approved'; exit; }` replaces the old `(int)$response !== 1` check
- final-code/changes.patch:175 resolveConfirmedPayment: 'isApproved' => !empty($txnInfo['isApproved']); the getTransactionDetails isApproved line is untouched (compare solution/fix.patch:105-106, which lowercases the status)
- final-code/changes.patch:108 (context) analyzeTransactionFromWebhook already lowercases: `$status = strtolower((string)$transactionRawObject->getTransactionStatus());`, an in-repo hint that status casing varies
- tests/support/AnetHarness.php:133-135 fixture 60000000001 status 'settledsuccessfully'; :153-155 fixture 60000000003 'settledSuccessfully'
- tests/functional/FuncLegacyPostTest.php:9-24 (fails, txn ...001) vs :26-39 (passes, txn ...003): isolates casing as the cause
- final-code/changes.patch:446-450 webhook.php: `if (empty($parsed['signatureValid'])) { http_response_code(401); ...}`; the patch never touches verifySignature
- solution/fix.patch:18-35: the pinned verifySignature does `$keyBin = hex2bin($signatureKeyHex)`; the reference switches to the raw key
- tests/support/AnetHarness.php:176-179 sign(): `hash_hmac('sha512', $rawBody, $signatureKey)` with the raw key
- build-notes.md:98-104: designed coupled contracts: raw-key verification ('pinned code hex-decodes the key') and case-insensitive settled status
- build-notes.md:134-136: lower-case status 'is not a live-API observation'
- instruction.md: 'A payment the provider reports as settled is still credited'; 'Every legitimate notification the integration accepts today is still accepted'; no mention of key encoding
- transcript.md:112-131: the agent ran only PHP syntax checks and a diff review; it never exercised a legitimate flow end to end

**Recommended action:** Keep reward 0 as a model failure. The legacy-post regression from the case-sensitive approval gate is enough on its own to fail the run under the stated keep-working contract. For the task owners: the raw-key signature contract (6 of the 7 failing functional tests depend on it) is not stated in the instruction. Consider adding a neutral hint, for example that genuine notifications are signed with HMAC-SHA512 using the configured signature key as-is, or record it as a known hard edge. Also consider making the security tests that use authentic signatures independent of the key encoding, so a verifier that rejects all genuine notifications cannot pass them vacuously.
