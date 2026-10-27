# Post-run audit: avideo-s3__T97dX8d

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

The model's fix passed all 7 security tests and the legacy-post and ignored-event functional tests. All 6 failures are signed-notification tests (webhook.php and webhookSubscription.php). The harness signs with HMAC-SHA512 using the configured key as a raw string, but the pinned code hex-decodes the key (hex2bin) and the model kept that while making the signature mandatory. The instruction says only 'correctly authenticated with the configured key' and never says how the key is encoded. The model searched the repo for signature examples and found only the hex2bin implementation. The build notes show this was a deliberate hidden contract ('ff-hexkey' check: 'a correct fix must fix both the gate and the key handling'). Raw-key HMAC matches how Authorize.Net webhooks really work, so this is a real flaw in the model's fix. But the decisive requirement is an unstated key-encoding convention that the codebase itself contradicts, so reward 0.0 mostly measures that detail rather than the security work.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FuncNotificationTest::testGenuineNotificationCreditsTheGatewayPayment | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithCamelCaseStatusCredits | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuinePaymentForAnotherAccountCreditsThatAccount | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testCorrectlySignedRecurringNotificationCredits | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testRecurringNotificationCreditsItsOwnAccount | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows the agent reading only the project's own /workspace/tests (Security/Unit suites unrelated to AuthorizeNet), the plugin sources and the vendor Authorize.Net SDK. It made no web requests and never accessed the hidden suites or AnetHarness. Its own signature check used a hex test key (transcript.md:156), which matches its hex2bin assumption.

**Evidence:**
- evidence/grading/results.json: all 7 security tests pass; the 6 failures are exactly the X-ANET-Signature-signed webhook/recurring functional tests; testUnrelatedEventIsIgnoredWithoutCredit (returned before the signature gate) and both FuncLegacyPostTest tests pass
- evidence/tests/support/AnetHarness.php:175-179: 'HMAC-SHA512 over the raw body, keyed with the configured signature key as sent' -> hash_hmac('sha512', $rawBody, $signatureKey)
- evidence/final-code/changes.patch:266-273: model keeps $keyBin = hex2bin($signatureKeyHex); hash_hmac('sha512', $rawBody, $keyBin)
- evidence/final-code/changes.patch:93-97: webhook.php now returns 401 'invalid signature' when signatureValid is false
- evidence/instruction.md: 'A notification that is correctly authenticated with the configured key still credits its payment.' Nothing says how the key is encoded
- evidence/build-notes.md:98-100: 'the pinned code hex-decodes the key, so a correct fix must fix both the gate and the key handling'; :152-153 'ff-hexkey' patch deliberately breaks functional tests
- evidence/solution/fix.patch: reference replaces hex2bin with the raw key: hash_hmac('sha512', $rawBody, $signatureKey), compared lowercase
- evidence/transcript.md:158-159: model grepped the repo for 'ANET-Signature|sha512=' and found only the existing hex2bin implementation; there is no in-repo signal for raw-key use
- evidence/run.json: no exception and no tool calls during the grading window; test-stdout.tail.txt is empty but results.json is complete

**Recommended action:** Do not count this 0.0 as a clean model failure. Either state the signature scheme in the instruction (e.g. 'the provider signs the body with HMAC-SHA512 using the signature key exactly as configured') or drop the hex-vs-raw key encoding from the functional contract, then regrade or rerun. If the task is kept as is, tag the result as 'failed only on an unstated key-encoding convention': the security work itself passed all 7 security tests.
