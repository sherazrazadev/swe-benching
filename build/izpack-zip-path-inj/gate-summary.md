# izpack-zip-path-inj - gate results (per-stage --only runs, in order)

Fairness revision run at: 2026-10-29T01:14Z - 2026-10-29T01:42Z (UTC). The previous round-2
results are preserved in `notes.md` and in the round-2 sections of this directory.

Task test set after the fairness revision: **17 security tests, 33 functional tests** (50 total).

## static
PASSED (no warnings). All 17 declared check files are present except `checks/blind.patch`, which is
declared with `kind: "blind"` and intentionally not built here (the brief reserves the blind fix for
an independent agent); `gate.py` tolerates that.

## nop
PASSED - 17 security tests failed on the pinned+injection code, 33 functional tests passed.
trial: gate-jobs/izpack-zip-path-inj-nop-1793237109

## oracle
PASSED - 3 runs, reward 1.0 each, identical security/functional maps (17/17 security, 33/33
functional, 50/50 in each run).
trials: gate-jobs/izpack-zip-path-inj-oracle{1-1793236903,2-1793236905,3-1793237014}

## patches
PASSED - every listed check behaved as declared (17 checks).

- sf-miss-L1.patch: expect=security_fail ok=True reward=0.7647 security_failing=4 functional_failing=0
- sf-miss-L2.patch: expect=security_fail ok=True reward=0.8235 security_failing=3 functional_failing=0
- sf-miss-B1.patch: expect=security_fail ok=True reward=0.8824 security_failing=2 functional_failing=0
- sf-miss-B2.patch: expect=security_fail ok=True reward=0.8824 security_failing=2 functional_failing=0
- sf-miss-S1.patch: expect=security_fail ok=True reward=0.8824 security_failing=2 functional_failing=0
- sf-miss-S2.patch: expect=security_fail ok=True reward=0.8824 security_failing=2 functional_failing=0
- sf-after-translation.patch: expect=security_fail ok=True reward=0.8824 security_failing=2 functional_failing=0
- sf-published-only.patch: expect=security_fail ok=True reward=0.2941 security_failing=12 functional_failing=0
- sf-miss-N1.patch: expect=security_fail ok=True reward=0.8235 security_failing=3 functional_failing=0
- sf-miss-N2.patch: expect=security_fail ok=True reward=0.8235 security_failing=3 functional_failing=0
- sf-miss-N3.patch: expect=security_fail ok=True reward=0.7647 security_failing=4 functional_failing=0
- sf-abort-install.patch: expect=security_fail ok=True reward=0.9412 security_failing=1 functional_failing=0
- sf-silent-skip.patch: expect=security_fail ok=True reward=0.9412 security_failing=1 functional_failing=0
- ff-substring-dotdot.patch: expect=functional_fail ok=True reward=0.0 security_failing=0 functional_failing=2
- ff-overbroad.patch: expect=functional_fail ok=True reward=0.0 security_failing=1 functional_failing=18
- pass-hardening.patch: expect=pass ok=True reward=1.0 security_failing=0 functional_failing=0
- pass-alt.patch: expect=pass ok=True reward=1.0 security_failing=0 functional_failing=0

Each original partial fix fails its own trap's test(s) and also the new P3 refusal-reporting test
(because it aborts the pack instead of continuing); every functional test still passes.
`sf-abort-install` and `sf-silent-skip` fail only the P3 test. `ff-substring-dotdot` fails only the
two dot-name positive controls. `ff-overbroad` fails 18 functional tests (all outside-install
targets and both dot-name controls) and, because it aborts, the P3 test. `pass-hardening` and
`pass-alt` score 1.0, including the P3 continuation and the dot-name/XML-merge cases.

Note: the per-stage gate reports share one partial-report filename, so the final
`gate_report.partial.json` holds the last (patches) stage; the per-stage PASS lines are in the logs
and reproduced above.
