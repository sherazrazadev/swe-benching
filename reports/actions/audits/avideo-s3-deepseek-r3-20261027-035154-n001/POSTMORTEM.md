# Post-run audit: avideo-s3__VMFWmhM

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

All 7 security tests pass. The reward is 0.0 only because 6 functional tests fail, and all 6 send a notification that the harness signs with the configured key used as a raw string (AnetHarness.php:176-179). The model made the repo's existing signature verifier a hard gate but did not change how that verifier handles the key: it still requires a hex key and hex-decodes it (ctype_xdigit/hex2bin, kept in changes.patch:15). So every raw-key-signed 'genuine' notification gets a 401 and credits nothing. The instruction only says a notification 'correctly authenticated with the configured key still credits'. It never says the key is used raw, and that contradicts the repo's own verifier. Only provider-protocol knowledge (the upstream fix comment 'used as a raw ASCII string — not hex-decoded') tells you otherwise. The task author built this in on purpose as the 'ff-hexkey' trap (build-notes.md). The model's binding to the gateway record and its route coverage look sound, so the 0.0 measures one unstated external convention, not the quality of the fix.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FuncNotificationTest::testGenuineNotificationCreditsTheGatewayPayment | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuineNotificationWithCamelCaseStatusCredits | fail | instruction-ambiguity | False | False |
| FuncNotificationTest::testGenuinePaymentForAnotherAccountCreditsThatAccount | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testCorrectlySignedRecurringNotificationCredits | fail | instruction-ambiguity | False | False |
| FuncRecurringTest::testRecurringNotificationCreditsItsOwnAccount | fail | instruction-ambiguity | False | False |
| SecNotificationTest::testAuthenticNotificationCannotChooseAnotherAccountOrAmount | pass | lenient-test | True | True |
| SecNotificationTest::testDeclinedTransactionIsNotCredited | pass | lenient-test | True | True |

**Lookup or leak:** None found. The agent explored only /workspace. The /workspace/tests files it read (transcript.md:48-57) are the repo's own PHPUnit tests, not the hidden suites. It made no network or upstream lookups, and run.json shows no tool calls during the grading window (agent_events_after_end: 0).

**Evidence:**
- tests/support/AnetHarness.php:175-179 — 'HMAC-SHA512 over the raw body, keyed with the configured signature key as sent': hash_hmac('sha512', $rawBody, $signatureKey)
- final-code/changes.patch:15 — verifier still begins 'if (empty($signatureKeyHex) || !ctype_xdigit($signatureKeyHex) ...'; the hex2bin line is untouched (the model only changed the header lookup)
- solution/fix.patch:46,58-60 — reference: 'The Signature Key is used as a raw ASCII string in the HMAC — not hex-decoded', removes hex2bin
- build-notes.md 'Coupled must-keep-working behaviour' — 'the pinned code hex-decodes the key, so a correct fix must fix both the gate and the key handling'; checks list 'ff-hexkey' as a patch designed to break functional tests
- instruction.md — 'A notification that is correctly authenticated with the configured key still credits its payment.' Nothing about the key's encoding or the HMAC scheme
- final-code/changes.patch:645-650 (webhook.php) and 469-475 (webhookSubscription.php) — new 401 hard gate on signatureValid
- grading/results.json — 7/7 security pass; every functional test that sends a signed notification fails (6/6); the unsigned silentPost functional tests and the ignored-event test pass, which fits a signature-only cause
- grading/test-stdout.tail.txt is empty, so the failing tests' assertion messages are not available; the cause is inferred from the code paths
- transcript.md:84-241 — the model never questioned the key encoding; its local harness exercised only the analysis logic

**Recommended action:** Do not count this 0.0 as a model failure. Either change the instruction so it pins the provider's signing scheme (e.g. 'the configured Signature Key is used as-is as the HMAC-SHA512 key, as Authorize.Net does'), or drop or decouple the functional assertions that depend only on key encoding. Then rerun. Separately, the authentic/declined security tests should require a credit (or a check on approval) in a scenario where the signature actually verifies, so a gate that rejects everything signed cannot pass them vacuously.
