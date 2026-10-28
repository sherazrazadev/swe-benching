# izpack-zip-path-inj - gate results (per-stage --only runs, in order)

Run at: 2026-10-28T07:33Z - 2026-10-28T07:48Z (UTC)

## static
PASSED

## nop
PASSED - 9 security tests failed on the pinned+injection code, 23 functional tests passed
trial: gate-jobs/izpack-zip-path-inj-nop-1793172825

## oracle
PASSED - 3 runs, reward 1.0 each, identical security/functional maps
trials: gate-jobs/izpack-zip-path-inj-oracle{1,2,3}-*

## patches
PASSED - every listed check behaved as declared

- sf-miss-L1.patch: expect=security_fail ok=True reward=0.6667 security_failing=3 functional_failing=0
- sf-miss-L2.patch: expect=security_fail ok=True reward=0.7778 security_failing=2 functional_failing=0
- sf-miss-B1.patch: expect=security_fail ok=True reward=0.8889 security_failing=1 functional_failing=0
- sf-miss-B2.patch: expect=security_fail ok=True reward=0.8889 security_failing=1 functional_failing=0
- sf-miss-S1.patch: expect=security_fail ok=True reward=0.8889 security_failing=1 functional_failing=0
- sf-miss-S2.patch: expect=security_fail ok=True reward=0.8889 security_failing=1 functional_failing=0
- sf-after-translation.patch: expect=security_fail ok=True reward=0.8889 security_failing=1 functional_failing=0
- sf-published-only.patch: expect=security_fail ok=True reward=0.5556 security_failing=4 functional_failing=0
- ff-overbroad.patch: expect=functional_fail ok=True reward=0.0 security_failing=0 functional_failing=9
- pass-hardening.patch: expect=pass ok=True reward=1.0 security_failing=0 functional_failing=0
- pass-alt.patch: expect=pass ok=True reward=1.0 security_failing=0 functional_failing=0

## Offline verifier image, direct run (network disabled)
- pinned+injection workspace: reward 0.0; 9/9 security fail, 23/23 functional pass
- oracle workspace: reward 1.0; 32/32 pass

Note: the per-stage gate reports share one partial-report filename, so the final
`gate_report.partial.json` holds the last (static) re-check; the per-stage PASS lines are in the
build log and reproduced above.
