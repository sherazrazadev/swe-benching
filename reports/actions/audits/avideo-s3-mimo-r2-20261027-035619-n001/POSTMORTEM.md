# Post-run audit: avideo-s3__u5Qvkik

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

All 7 security tests passed. The reward is 0 because 7 of 9 functional tests failed, and each failure comes from one of two hidden contracts that the instruction never states. (1) Genuine notifications are signed with the configured key used as a raw string, but the pinned verifier hex-decodes the key. The model kept the integration's own verifier and enforced it, which matches the instruction's literal wording ('fails the authentication the integration checks must not credit'). The result is a 401 on every correctly signed webhook and recurring notification (6 tests). (2) The legacy-post test uses a fixture whose status is the lower-case 'settledsuccessfully'. The product's isApproved check is case-sensitive, and the model relied on it, so that test failed. The build notes admit that the real API was never observed to return this spelling. A literal-reading, otherwise sound fix fails both traps, so the 0 does not fairly measure the model. The model does share some blame: it stubbed out the real verifySignature in its self-check and never tested the actual key handling.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FuncNotificationTest::testGenuineNotificationCreditsTheGatewayPayment | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithCamelCaseStatusCredits | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuinePaymentForAnotherAccountCreditsThatAccount | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testCorrectlySignedRecurringNotificationCredits | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testRecurringNotificationCreditsItsOwnAccount | fail | instruction-ambiguity | False | False |
| FuncLegacyPostTest::testMatchingLegacyPostCreditsThePayment | fail | test-fault | False | False |
| SecNotificationTest::testNotificationWhenNoSignatureKeyIsConfiguredDoesNotCredit | pass | lenient-test | True | True |

**Lookup or leak:** None found. The agent read only the repository's own /workspace/tests (the unrelated AVideo suites) to see the house test style. It never touched the hidden tests (.htests or /tests), and it made no web or upstream lookups. It built its own stub harness in /tmp/anet-check. run.json shows no tool calls during the grading window.

**Evidence:**
- grading/results.json: security 7/7 pass; functional 2/9 pass; reward 0.0 because a functional test failed (score.py threshold rule)
- build-notes.md:98-99 'the pinned code hex-decodes the key, so a correct fix must fix both the gate and the key handling': a deliberate hidden trap (also listed as the 'ff-hexkey' check at build-notes.md:152-153)
- instruction.md security invariant: 'a notification that fails the authentication the integration checks must not credit anything'. Read literally, this endorses enforcing the integration's existing (hex-decoding) verifier; the instruction never mentions key encoding
- AnetHarness.php:175-179 sign(): hash_hmac('sha512', body, signatureKey) with the raw key; solution/fix.patch:27-35 replaces hex2bin with the raw key
- build-notes.md:31-34 (T4) case-sensitive status trap; build-notes.md:134-136 'Whether the live Authorize.Net API really returns transaction statuses in the lower case ... it is not a live-API observation'
- changes.patch:58-73 silentPost isApproved: prefers the product's txnInfo['isApproved'] and lower-cases only in the fallback branch
- transcript.md:96 the agent stubbed AuthorizeNet::verifySignature in its own harness, so the real key handling was never exercised (a genuine shortfall, but against a requirement the instruction does not state)
- run.json: tool_calls_during_grading [] and exception_info null; all five JUnit groups produced results (16 tests)

**Recommended action:** Do not count this 0 as a model failure. Either (a) state the provider contract in the instruction, e.g. that genuine notifications are HMAC-SHA512 of the body keyed with the configured signature key as given, and that settled statuses may arrive in any letter case, or (b) drop or relax FuncLegacyPostTest::testMatchingLegacyPostCreditsThePayment's lower-case fixture, since the build notes say the real API was never seen to send it. Then re-grade or exclude this trial. Also consider a security test that sends a body-consistent, unsigned notification with no key configured, to close the lenient pass.
