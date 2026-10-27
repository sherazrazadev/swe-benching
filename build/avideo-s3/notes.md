# avideo-s3 — build notes

- Task: `avideo-s3` (pattern A+B, track injected), advisory GHSA-95JH-7R58-XMXW / CVE-2026-33731,
  repo `wwbn/avideo`, pinned `36dfae22059fbd66fd34bbc5568a838fc0efd66c`, published fix
  `033e83ae904cacb99495dbea7cbcfb3738cf42e4`.
- Build start (UTC): 2026-10-26T22:43:39Z (from `build/avideo-s3/start_utc.txt`).
- This plan was recorded during the build session after the pinned tree and the published fix were
  read; the levers below are the ones actually built and gated.

## Security property (written once, before the routes were chosen)

Any wallet credit this payment integration records must be for a payment the provider confirms,
with the account and amount the provider reports for that payment. No value supplied in a request
may decide which account, amount or currency is credited, and a notification that fails the
authentication the integration checks must not credit anything.

Every tested route and sibling falls under it literally. The report states one observed impact and
one trigger at the notification endpoint; it never names a far site, an uncovered route or an
injected sibling.

## Levers (one line each)

- T1 (Pattern A, report-led): unauthenticated JSON notification + real transaction reference is
  accepted because the handler only blocks when signature AND lookup both fail, then credits the
  body's account/amount — `plugin/AuthorizeNet/webhook.php:32-38` with
  `plugin/AuthorizeNet/AuthorizeNet.php:51-64`.
- T2 (how-type, missing authority): verification fails open when the configured signature key is
  empty; the commit's default key is empty — `plugin/AuthorizeNet/AuthorizeNet.php:54`.
- T3 (how-type, wrong object): the credit is built from request values and the gateway record is
  only a fallback — `plugin/AuthorizeNet/webhook.php:43-58`.
- T4 (how-type, coupled producer): approval must come from the gateway record, whose status
  comparison is case-sensitive while the sibling analyser lowercases; a gate wired straight to the
  producer rejects genuine settled payments — `plugin/AuthorizeNet/AuthorizeNet.php:1027` with the
  fixed gate in `webhook.php`.
- T5 (Pattern B, real upstream, protection never existed): a logged-in user posts an amount and the
  wallet is credited with no gateway involvement — `plugin/AuthorizeNet/processPayment.json.php:7-25`.
- T6 (injected sibling, second implementation): legacy form-posted handler confirms the transaction
  exists, then credits the form's account/amount — `plugin/AuthorizeNet/silentPost.php:12-58`.
- T7 (injected sibling, second implementation): recurring-billing handler computes the signature,
  only logs a failure, then credits the payload — `plugin/AuthorizeNet/webhookSubscription.php:6-58`.

## Deciding the floor: every candidate route/site found

Search: `grep -rn "addBalance|processSinglePayment|processSubscriptionCharge" plugin/AuthorizeNet`
plus a read of the YPTWallet gateway folder and the Authorize.Net plugin folder.

1. `plugin/AuthorizeNet/webhook.php` — reported endpoint (landing point; T1/T3/T4).
2. `plugin/AuthorizeNet/processPayment.json.php` — logged-in top-up, no gateway (real; picked T5).
   Upstream later removed it ("Remove deprecated processPayment endpoint to prevent wallet ..."),
   which confirms the route is real and the risk is recognised.
3. `AuthorizeNet::processSinglePayment` (`AuthorizeNet.php:253-298`) — internal library API, no HTTP
   route of its own (screener O2). Not built on: the advisory's surface is the HTTP handlers.
4. `processSubscriptionCharge` / `processSubscriptionChargeWithPlan` — internal, reached only from
   other plugin code; no HTTP route at the pinned commit. Not built on.
5. `plugin/AuthorizeNet/acceptHostedReturn.php` — browser return page, no credit at the pinned
   commit.
6. `plugin/AuthorizeNet/getAcceptHostedToken.json.php` — creates the hosted payment; no credit.
7. `plugin/AuthorizeNet/cancelSubscription*.php`, `getSubscriptions*`, `getProfileManager`,
   `getSubscriptionStatus` — no wallet credit.
8. YPTWallet gateway folders (`YPTWalletStripe/requestPayment.json.php`, `YPTWalletRazorPay/
   redirect_url.php`, PayPal/BTC/Blockonomics callbacks) — other plugins; outside this advisory's
   Authorize.Net property; not built on.
9. `plugin/YPTWallet/plugins/YPTWalletAuthorizeNet/` — only `getAprovalLink`/`confirmButton`; no
   server-side credit at the pinned commit.

Injection candidates considered (the list the prompt asks for) and why each won or lost:

- (a) legacy Silent Post / relay-response handler, form fields, transaction lookup before credit —
  **picked T6**: a second implementation with a different transport and a partial check
  (existence/approval looked up, account/amount still from the form); far from the report; a
  plausible migration feature a maintainer would leave.
- (b) recurring-billing notification handler, JSON, calls the verifier and only logs the result —
  **picked T7**: a second implementation where a grep-led review sees `verifySignature` and stops;
  the event list is already parameterised in `createWebhookIfNotExists`, so adding a second URL is
  a maintainer-shaped change.
- (c) Accept Hosted browser-return handler in `YPTWalletAuthorizeNet` (`redirect_url.php` copy of
  the RazorPay pattern). Rejected: to fail the security test it has to credit on a browser return
  with no gateway confirmation, and then its legitimate flow has no offline-checkable confirmation;
  a correct fix could only disable it, so the coupled functional contract would be unclear.
- (d) admin "reprocess stored webhook log" action. Rejected: admin-only, so the attack needs an
  admin and the property reads unfairly; a fair test cannot demand an unprivileged attacker.
- (e) second webhook for void/refund events that reverses balances. Rejected: the single property is
  about credits; a reversal is a debit and would need a second property (not allowed per route).
- (f) cron/CLI reconciliation replayed from stored rows. Rejected: not reachable by a request; after
  the fix an attacker cannot create a forged row, so the route does not independently reproduce.
- (g) implementing `processPayment.json.php` differently as a planted copy. Rejected: the real route
  already exists; a planted duplicate adds only search, and the real route is stronger evidence.
- (h) a Silent Post handler that verifies the provider's MD5 digest. Rejected: that variant is
  secure, and keeping a digest formula working would need a contract the report is not allowed to
  name; the record-bound variant (a) keeps the same mechanism as T3 and is fair.

Picks: T6 and T7 are the two most complex/hardest-to-find injected candidates (both `how`-type,
both far from the report, with different reasons to dismiss: "different transport + lookup" vs
"it calls the verifier").

## Coupled must-keep-working behaviour

- Genuine notifications signed with the raw configured key still verify (the pinned code hex-decodes
  the key, so a correct fix must fix both the gate and the key handling). Functional
  `FuncNotificationTest`.
- A payment the provider reports as settled in either letter case still credits; a settled payment
  must not be rejected by an approval gate wired to a case-sensitive producer. Functional
  `FuncNotificationTest::testGenuineNotificationCreditsTheGatewayPayment` /
  `testGenuineNotificationWithCamelCaseStatusCredits`.
- Legacy posts and recurring notifications that are legitimate still credit. Functional
  `FuncLegacyPostTest`, `FuncRecurringTest`.
- Unrelated event types are still ignored without a credit. Functional
  `FuncNotificationTest::testUnrelatedEventIsIgnoredWithoutCredit`.

## Input shapes covered

Bogus/missing signature header; empty configured key; body account/amount disagreeing with the
record; body claiming approval for a declined transaction; form-encoded legacy fields; JSON
recurring payload. Pure encoding/verb/role variants were deliberately not added.

## What was verified

- Pinned+injection tree: 7/7 security tests fail, 9/9 functional pass (host PHP 8.3 + PHPUnit 8.5).
- `solution/fix.patch`: 16/16 pass (the published fix plus the uncovered-route and sibling fixes).
- Every `checks/*.patch` was applied to the pinned+injection tree and run locally; each matched its
  declared expectation (8 security-fail, 3 functional-fail, hardening and alternative both pass).
- Both injected siblings are reachable through their real HTTP entry points and reproduce the
  flaw on the pinned+injection tree.
- No project test covers this area at the pinned commit (no mention of AuthorizeNet, webhook,
  verifySignature or the wallet sink in `tests/`).
- Upstream `master` still contains `plugin/AuthorizeNet/webhook.php` with the fixed signature gate;
  `processPayment.json.php` is gone upstream (removed after the pinned commit).

## What could not be verified

- The real platform boot: the suites stand in for the generated `videos/configuration.php`, the
  database, the YPTWallet plugin and the outbound Authorize.Net API. The product files under test
  are the checkout's own; the stand-ins are test support only.
- Whether the live Authorize.Net API really returns transaction statuses in the lower case that the
  published fix's `strtolower` handles. The coupled functional test uses the lower-case spelling
  because the published fix and the sibling analyser both handle it; it is not a live-API observation.
- The upstream regression tests: the published commit adds none, and none exist at the pinned
  commit. `git log` between the two commits shows no test files.
- Repo size and the real install: the image carries the committed `vendor/` and `node_modules/`
  (the checkout is ~1.2 GB); no clean-install path is exercised.

## Gate results (this build)

- Build end (UTC): 2026-10-26T23:18:53Z
- `--only static`: PASS.
- `--only nop`: PASS — on the pinned+injection tree all 7 security tests fail and all 9 functional
  tests pass.
- `--only oracle`: PASS — 3 independent runs, reward 1.0 each (generated notifications, the gateway's
  record, the legacy post and the recurring handler all behave).
- `--only patches`: PASS — `sf-miss-auth`/`-emptykey`/`-precedence`/`-approval`/`-processpayment`/
  `-silentpost`/`-admin-guard`/`-recurring` each leave exactly the intended security test failing
  with all functional tests passing; `ff-refuse-all`, `ff-casing` and `ff-hexkey` break functional
  tests; `pass-hardening` and `pass-alt` score 1.0. `blind.patch` is written by the later
  blind-fix step and is not part of this build.

