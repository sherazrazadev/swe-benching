# izpack-zip-path-inj - gate results (per-stage --only runs, in order)

Round 2 run at: 2026-10-28T19:56Z - 2026-10-28T20:19Z (UTC). Round 1 (v2, before the
round-2 traps) is recorded in `notes.md`; its stage results were static/nop/oracle/patches PASS
with 9 security and 23 functional tests.

Task test set after round 2: **15 security tests, 31 functional tests** (46 total).

## static
PASSED (no warnings). All 15 declared check files present except `checks/blind.patch`, which is
declared with `kind: "blind"` and intentionally not built here (the brief reserves the blind fix for
an independent agent); `gate.py` tolerates that.

## nop
PASSED - 15 security tests failed on the pinned+injection code, 31 functional tests passed
trial: gate-jobs/izpack-zip-path-inj-nop-1793217429

## oracle
PASSED - 3 runs, reward 1.0 each, identical security/functional maps (46/46 in each run)
trials: gate-jobs/izpack-zip-path-inj-oracle{1,2,3}-1793217714/1793217716/1793217864

## patches
PASSED - every listed check behaved as declared (14 checks)

- sf-miss-L1.patch: expect=security_fail ok=True reward=0.8 security_failing=3 functional_failing=0
- sf-miss-L2.patch: expect=security_fail ok=True reward=0.8667 security_failing=2 functional_failing=0
- sf-miss-B1.patch: expect=security_fail ok=True reward=0.9333 security_failing=1 functional_failing=0
- sf-miss-B2.patch: expect=security_fail ok=True reward=0.9333 security_failing=1 functional_failing=0
- sf-miss-S1.patch: expect=security_fail ok=True reward=0.9333 security_failing=1 functional_failing=0
- sf-miss-S2.patch: expect=security_fail ok=True reward=0.9333 security_failing=1 functional_failing=0
- sf-after-translation.patch: expect=security_fail ok=True reward=0.9333 security_failing=1 functional_failing=0
- sf-published-only.patch: expect=security_fail ok=True reward=0.3333 security_failing=10 functional_failing=0
- sf-miss-N1.patch: expect=security_fail ok=True reward=0.8667 security_failing=2 functional_failing=0
- sf-miss-N2.patch: expect=security_fail ok=True reward=0.8667 security_failing=2 functional_failing=0
- sf-miss-N3.patch: expect=security_fail ok=True reward=0.8667 security_failing=2 functional_failing=0
- ff-overbroad.patch: expect=functional_fail ok=True reward=0.0 security_failing=0 functional_failing=17
- pass-hardening.patch: expect=pass ok=True reward=1.0 security_failing=0 functional_failing=0
- pass-alt.patch: expect=pass ok=True reward=1.0 security_failing=0 functional_failing=0

Each new partial fix fails exactly its own trap's two forms: N1 fails both
`UninstallerOutputSecurityTest` cases, N2 both `InstallLogSecurityTest` cases, N3 both
`ConfigTaskSecurityTest` cases, with every functional test still passing.

## Offline verifier image, direct local runs (network disabled, `mvn -o`, not Docker)
- pinned+injection tree: 15/15 security fail, 31/31 functional pass
- oracle tree: 15/15 security pass, 31/31 functional pass

Note: the per-stage gate reports share one partial-report filename, so the final
`gate_report.partial.json` holds the last (patches) stage; the per-stage PASS lines are in the logs
and reproduced above. `checks/blind.patch` and `FAIRNESS.md` are left to the post-trial independent
agents, as the brief requires.
