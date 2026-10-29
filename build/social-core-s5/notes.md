# social-core-s5 — build notes

Start (UTC): 2026-10-28T23:50:23Z
End (UTC): 2026-10-29T00:08:30Z

Task: python-social-auth/social-core, pinned at 6fcde2c2bf16b6fefb15316e4c9f7a9d9ddfd95b
(parent of published fix 0418782454ac7bbc6a9230ea21f7f5066fe89686). Pattern A+B, track
injected. Advisory: GHSA-VQG6-3FW6-J9JG / CVE-2026-57179 / PYSEC-2026-4168, CWE-384.

## Security property (written once, before choosing routes)

A stored sign-in flow may be continued only by the browser session that started it, or, for a
flow the library itself set up to be completed from outside the starting session, by a request
that presents the proof that flow was set up to require. A session must not continue a stored flow
it did not start, whether the request supplies an identifier, a stored flow object, or any other
value. A refused request must not continue a stored flow, run a step, consume it, or sign anyone in.

Every route and sibling below is covered by that sentence; the report never names any of them.

## Levers (one line each)

- T1 (how-type, main): producer off the check's path + coupled must-keep-working — the resume
  decision needs the out-of-band completion allowance recorded on the stored flow when it
  halted; the check reads the saved allowance and never calls the producer, and a plain
  session-equality rule breaks the emailed validation completion (social_core/utils.py:289-397
  check; social_core/pipeline/partial.py:45-58 and social_core/pipeline/mail.py:13-37 producer).
  Dismissal: the halting decorator reads as internal state bookkeeping, not policy.
- T2 (how-type): route where the protection never existed — the public backend resume hook
  continues any stored flow it is handed (social_core/backends/base.py:269-275). Dismissal: a
  lower-level library API used by framework integrations, not a user-facing view. Real,
  unmodified upstream code.
- T3 (where-type, injected): second implementation in a different module — a public pipeline
  resume helper loads a flow by identifier and continues it through the authentication entry
  point, bypassing the shared utility (social_core/pipeline/utils.py:107-135). Dismissal:
  internal storage plumbing next to the loader/store helpers.
- T4 (where-type, injected): second implementation behind a subclass override — a provider
  backend restores saved identity claims and runs the stored flow itself instead of delegating
  to the base hook (social_core/backends/facebook_limited.py:35-50). Dismissal:
  provider-specific restore path; a base-class fix is not inherited.

## Full candidate list and why the picks won

Every place found where a stored flow can be continued, or where its resume policy is produced:

1. `social_core/backends/base.py` BaseAuth.continue_pipeline — real upstream, unguarded. PICKED
   (T2): the strongest real "protection never existed" route; costs only a search, so it is the
   real backbone rather than the main difficulty.
2. `social_core/backends/open_id.py` BaseOpenID.continue_pipeline — real upstream override.
   REJECTED: it passes response= together with partial.kwargs, and partial.kwargs always already
   contains response, so a product-produced partial raises TypeError before any flow resumes;
   making it reachable would mean injecting a behaviour fix to a real route.
3. `social_core/backends/facebook_limited.py` (Facebook Limited Login / OIDC) — no override at the
   pinned commit; upstream later added one for claim restoration. PICKED as injected T4: the
   override is plausible maintainer code, sits in a different package, and bypasses the base hook;
   it needs its own ownership decision.
4. `social_core/pipeline/utils.py` public loader/store helpers — the loader alone is not a sink.
   PICKED as an injected resume helper in the same module (T3), because a second implementation
   there is fixed by neither the shared utility nor the base hook.
5. `social_core/actions.py` sibling action handler calling the shared resume utility. REJECTED:
   a fix in the shared utility covers it automatically, and the published fix already edits this
   file, so it is not "placed where the published fix never touches".
6. `social_core/strategy.py` second framework-style confirmation hook or loader override.
   REJECTED: the published fix edits strategy.py; framework strategies live outside the repo.
7. A second external-resume pipeline step (phone/OTP) that opts in. REJECTED: at the pinned commit
   there is no opt-in mechanism to reuse, so injecting the step would require injecting the very
   allowance machinery the solver must design; that leaks the fix.
8. `social_core/backends/base.py` a second convenience method taking a token. REJECTED: same file
   and same concept as T2, fixed by the same base-level reasoning; adds little.
9. `social_core/pipeline/partial.py` decorator / `social_core/pipeline/mail.py` step — producers,
   not resume sinks. Used as the T1 producer, not as an injected gap.
10. A cached/reloaded flow path — the project has no cache; nothing to build on.

T3 and T4 beat 5–9 on the stated criteria (second implementations in different modules, reachable
through public APIs, distinct dismissal reasons), and T2 beats 2 and 8 because it is real,
reachable, and unmodified upstream code.

## What was verified

- Local matrix (Python 3.12 venv, pinned+injection): nop security 0/8, functional 9/9; oracle
  security 8/8, functional 9/9; project tests 51/51 in every variant.
- Every `checks/` patch behaves as declared: upstream_only fails the three routes it does not
  guard; miss_continue/helper/provider/external each fail exactly their one security case;
  ff_refuse_all and ff_refuse_external break functional cases; sf_crash and sf_wrong_resource fail
  security cases cleanly; pass_alt_loader and pass_hardening score 1.0.
- Gate stages run in order, one at a time: static PASS, nop PASS, oracle PASS (3 runs), patches
  PASS. Reports: `build/social-core-s5/gate_report.partial.json` (last stage) and the per-stage
  evidence directory.
- The published fix leaves the base hook, the pipeline helper and the provider override open:
  `upstream_only.patch` scores 0.625 with those three security cases failing.
- Pinned tree contains none of the advisory's regression tests (`git log 6fcde2c..0418782` adds
  test_utils/test_mail/test_partial/test_login tests only in the fix commit).

## What could not be verified / guesses

- No target-model trials were run (the brief forbids it), so the bar (both models failing 3/3)
  is not measured here; this task is built, not proven a breaker.
- `present_in_latest` for T2 was checked read-only against upstream HEAD 65856ed: the public hook
  still has no ownership decision, but the shared utility was reworked later, so its practical
  exploitability upstream is only partly understood. The register records `yes`.
- Injected siblings T3/T4 exist only in this task's source variant by definition.
- The host has Python 3.12; the gate images use 3.13 and all four stages passed there.
- Fairness risk I see: the reference fix completes an out-of-band flow with a confirmation round
  trip. The functional test accepts either a direct completion or that round trip (it looks for
  the confirmation response), but a solver who invents a third, different handshake would not be
  driven by the test. The instruction states the outcome ("completed from outside the starting
  session ... including the proof such a flow requires"), not a handshake, so this is a narrow
  residual risk rather than a hidden contract.
- The screener's O7 "producer" claim was not independently validated; the producer lever was
  designed from the pinned code and the published fix.

## Outside scope, noted once

Current upstream HEAD contains a much larger, separate rework of stored-flow handling
(pipeline-type context, claim-restoration overrides in OIDC backends) unrelated to this advisory;
it was only read to answer `present_in_latest` and nothing was built on it.
