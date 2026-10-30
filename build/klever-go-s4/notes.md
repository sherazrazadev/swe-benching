# klever-go-s4 build notes

- Start (UTC): 2026-10-30T15:03:33Z
- End (UTC): 2026-10-30T15:37:56Z
- Advisory: GHSA-CGC5-V3F2-8M2V / CVE-2026-54755 / GO-2026-6310 (CWE-190, percentage arithmetic in
  royalty splits -> payout above the funded royalty -> token minting)
- Pinned: 085a5d1c9956b71efa8546b7b66314237324c80c. Published fix: 8bcc600b0ac88070740c63c7ce1c8a968dd85251
  (a merge commit that also carries GHSA-p7gw-2pcp-5pf8 and GHSA-mrpp-v6pg-p54x; only the split-royalty
  portion of the merge is in scope here).
- Pattern A, injected track. All work is on this repository; nothing was pushed or published.

## Levers (one line each)

1. `create_wrapped_shares` (A, reported): the create path sums the split fields into uint32, so two shares
   each above 100% whose sum wraps to zero pass the aggregate 100% check; core/kapp/kda/create.go:367 and
   :253. Reason to dismiss: the aggregate check looks like it validates the map.
2. `trigger_wrapped_shares` (A): the same values through the royalty-update trigger; core/kapp/kda/trigger.go:712.
   Reason: it reuses the aggregate check.
3. `transfer_pool_bound` (A): the transfer settlement loop subtracts each split from the pool with no bound,
   so stored shares above 100% (or summing above 100%) credit more than the royalty taken; accounts.go:276.
   Reason: stored configuration reads as trusted.
4. `whole_pool_conservation` (A, how-type): shares that consume the whole royalty make the remainder zero, the
   early return is taken and the payer is never debited, so the credit is minted; accounts.go:474-506.
   Reason: exactly 100% is a legitimate share, not an overflow; the missing debit is an ordering consequence.
   A `>` guard does not fix it and a `>=` guard rejects legitimate use.
5. `fixed_pool_bound` (injected, how-type): the fixed-royalty transfer has a second payout implementation
   whose per-split check compares to the original fixed amount, so two 60% shares each pass and together pay
   120%; accounts.go:316. Reason: it already checks every split and debits the payer first.
6. `market_pool_bound` (A, far site): the marketplace purchase has its own settlement loop with no pool bound;
   market.go:401. Reason: the escrow already carves the royalty out of the bid.
7. `ito_pool_bound` (A, far site): the token-offering purchase has its own settlement loop with no pool bound;
   ito.go:581. Reason: the buyer is debited the full purchase value.
8. `ito_fixed_pool_bound` (injected): the fixed offering royalty is paid through a second settlement
   implementation with no bound after the payer is debited; ito.go:533. Reason: debit-first looks conserved.

## Verified

- All eight levers reproduce at the pinned commit through ProcessTransaction (real in-memory
  trie/accounts fixtures): wrapped create and update are accepted; a stored 200% share credits
  2x the royalty; 60/60 shares credit 120%; a 100% share credits the royalty and debits the payer
  nothing; marketplace and ITO purchases credit 2,576,980,377 / 1,073,741 / 21,474,836 units from a
  1,200,000 / 10 / 100 unit pool; the injected fixed paths credit 120% and 200% of their pools.
- On the oracle every security and functional test passes: 10 security / 8 functional dedicated tests plus
  the affected packages' project tests.
- Every check patch was applied to pinned+injected locally and again through the gate's patches
  stage; every declared outcome reproduced (8 security_fail, 1 functional_fail, hardening and
  alt_fix both reward 1.0).
- Gate results: static PASSED; nop PASSED (10 security tests fail on vulnerable code, 712
  functional cases pass); oracle PASSED (3/3 trials reward 1.0, identical test maps); patches
  PASSED (11/11 checks behave as declared). `blind.patch` and FAIRNESS.md are left for the
  blindfix and fairness steps, as the build prompt requires.
- Project tests at pinned+injected pass in full; on the oracle all pass except accounts'
  `Test_ComputeSplitRoyalties`, an isolated unit test that calls the internal helper with an already
  exhausted pool (royaltiesToPay=0) and therefore asserts the old contract. The upstream fix updates that
  test. The graded functional group excludes exactly that one test; every other project test in the
  affected packages is graded.
- Offline build: modules and the affected packages' build/test graph are warmed in both images; tests run
  as uid 1000 with GOMODCACHE=/go/pkg/mod, GOCACHE=/go/cache, GOTOOLCHAIN=local, CGO_ENABLED=0.

## Not verified / guesses

- `present_in_latest` / `public_upstream_report` in the register are unknown: no later upstream checkout was
  read. The two injected siblings exist only in our copy.
- The trial difficulty bar (both target models failing 3/3) is not measured here; the harness runs it after
  this build.
- The sibling advisory and the unrelated changes carried by the merge commit were not built on (one line,
  scope note): the market referral+royalty inflation guard, the account freeze, the SFT circulation guard and
  the KApp read-concurrency change are out of this advisory's scope.

## Outside scope noticed

- The merge commit also fixes GHSA-p7gw-2pcp-5pf8 (market referral+royalty inflation), GHSA-mrpp-v6pg-p54x
  (SFT circulation overflow) and carries an unrelated KApp read-concurrency change; none were pursued.
