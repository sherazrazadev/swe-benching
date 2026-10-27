# FAIRNESS — avideo-s3

| Test (file::name) | Asserts | Instruction sentence that makes it fair | Could a correct fix fail it? | Risk |
|---|---|---|---|---|
| security/SecNotificationTest.php::testForgedNotificationDoesNotCreditAnything | Forged `sha512=` header + real txn → 4xx, empty wallet | Invariant: "a notification that fails the authentication the integration checks must not credit anything"; Refusal: "refused with a client error" | no — any signature gate (401/400/403) passes | low |
| security/SecNotificationTest.php::testNotificationWhenNoSignatureKeyIsConfiguredDoesNotCredit | Empty configured key + signature → 4xx, no credit | Invariant: same authentication clause (an absent key cannot authenticate); Refusal | no — fail-closed is the literal reading; skipping auth when unconfigured violates it | low |
| security/SecNotificationTest.php::testAuthenticNotificationCannotChooseAnotherAccountOrAmount | Signed body 7/999, record 42/5.00 → ≤1 credit, any credit must be 42/5.00 (none allowed) | Invariant: "No value supplied in a request may decide which account, amount or currency"; "account and amount … the provider holds" | no — record-binding and refusal both pass | low |
| security/SecNotificationTest.php::testDeclinedTransactionIsNotCredited | Signed body claims approval, record declined → no credit | "a payment the provider reports as not approved is not [credited]" | no | low |
| security/SecForgottenRouteTest.php::testWalletTopUpEndpointDoesNotCreditWithoutAPayment | Logged-in **admin** posts `amount=1000` to top-up → 4xx, no credit | Invariant read literally: any wallet credit must be provider-confirmed; refusal | no — refusing (even 404 by deletion) passes; admin-only guard is not correct, a request amount still decides | medium |
| security/SecForgottenRouteTest.php::testLegacyPostCannotChooseTheAccountOrAmount | Form 7/1000 + real txn → ≤1 credit, any credit 42/5.00 | Invariant: no request value may decide account/amount | no — binding or refusal both pass | low |
| security/SecForgottenRouteTest.php::testRecurringNotificationCannotBypassAuthentication | Forged signature on recurring route → 4xx, no credit | Invariant: failed authentication must not credit; Refusal | no | low |
| functional/FuncNotificationTest.php::testGenuineNotificationCreditsTheGatewayPayment | Signed 42/5.00 txn …01 → 2xx, exactly one 42/5.00 credit | "correctly authenticated with the configured key still credits"; "settled is still credited"; record authority | no — passes only if the key is used as configured and status case is normalized; a raw-key / case-sensitive fix refuses a genuine settled payment, violating keep-working | medium |
| functional/FuncNotificationTest.php::testGenuineNotificationWithoutBodyFieldsUsesTheTransactionRecord | Signed body, no metadata/amount → record 42/5.00 credited | "the account and amount … the provider holds"; "Every legitimate notification … still accepted" | no — record fallback is stated | medium |
| functional/FuncNotificationTest.php::testGenuineNotificationWithCamelCaseStatusCredits | txn …03 camel status → 42/5.00 credited | "settled is still credited" | no | low |
| functional/FuncNotificationTest.php::testGenuinePaymentForAnotherAccountCreditsThatAccount | txn …04 → exactly 43/7.50 | record authority | no | low |
| functional/FuncNotificationTest.php::testUnrelatedEventIsIgnoredWithoutCredit | Signed void event → <500, no credit | keep-working + refusal; ignoring is existing behaviour | no | low |
| functional/FuncLegacyPostTest.php::testMatchingLegacyPostCreditsThePayment | Form 5.00/42 + txn …01 → 42/5.00 | "Every legitimate notification the integration accepts today is still accepted" | no | low |
| functional/FuncLegacyPostTest.php::testLegacyPostWithoutAccountOrAmountUsesTheTransactionRecord | Form txn …03 only → 42/5.00 | record authority + keep-working | no | low |
| functional/FuncRecurringTest.php::testCorrectlySignedRecurringNotificationCredits | Signed 42/5.00 recurring → 42/5.00 | authenticated notification still credits | no | low |
| functional/FuncRecurringTest.php::testRecurringNotificationCreditsItsOwnAccount | Signed 43/7.50 recurring → 43/7.50 | record/account authority | no | low |

**READY reasoning (gate a).** All security tests are covered by the single invariant read literally over "any wallet credit", plus Refusal. The body-precedence tests accept either no credit or exactly the gateway credit, so any valid guard layer or allowed refusal form passes. Functional tests track "What must keep working". Two conventions are visible by code audit: the configured `signatureKey` is the HMAC key verbatim (pinned `hex2bin` is the defect), and a settled status may arrive lower-cased (the sibling analyser lowercases). A fix reusing either producer fails functionally, but then refuses a genuinely signed/settled payment, so it is not correct. No contradiction, unfaithful harness or impossible spec.

**Required: generalize** — none. No sentence names a file, route, sibling, command, format or flaw count; the property is stated once over the protected outcome.

**Quality to tighten.**
- Leniency: recurring payload precedence is uncaught (the reference credits `$analysis`). Add a signed recurring body for txn …01 carrying 7/999, assert only 42/5.00, and bind the reference to `getTransactionDetails`.
- Leniency: legacy approval comes from form `x_response_code`; no declined legacy test. Add `testLegacyPostForDeclinedTransactionDoesNotCredit` (txn …02, `x_response_code=1`).
- Leniency: currency is unobserved (the stand-in records only `users_id`/`amount`). Record and assert it, or drop "currency" from the property.
- Hints: "correctly authenticated with the configured key" → "the integration can authenticate"; "reports as settled … not approved" → "confirms as completed … reports as failed"; "5.00 … to the paying account" → "the amount and account the provider holds"; "Fix the problem and its close variants." → "Fix the underlying flaw wherever it occurs."
- Realism: T1–T4 real upstream, T5 real unmodified (not out of scope), T6/T7 plausible HTTP-reachable siblings. One contrivance: `settledsuccessfully` (…01) beside `settledSuccessfully` (…03); notes admit the lower case is not live-API. State the spelling is not case-stable, or make fixtures realistic.

Human review: confirm the hidden raw-key HMAC convention and the lowercase `settledsuccessfully` fixture; a fix trusting the pinned `hex2bin` verifier or the case-sensitive producer fails functional tests.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
