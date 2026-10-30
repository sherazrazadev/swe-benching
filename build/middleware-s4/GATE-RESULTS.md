# middleware-s4 gate results (2026-10-29)

Stages were run one at a time with `python3 -I common/gate/gate.py middleware-s4 --only <stage>`,
as the build brief requires. Each `--only` run writes `gate_report.partial.json`, overwriting the
previous one; this file is the durable summary. Full stdout of each stage is in
`~/.tb-graders/cwe/work/middleware-s4/gate-<stage>.log`; trial artifacts are under
`~/.tb-graders/cwe/gate-jobs/`.

| stage | verdict (exit) | finished (UTC) | evidence |
|---|---|---|---|
| static | PASSED (0) | 13:25:22 | final instruction (475 words), conformance, leak scan, catalogue, patch files |
| nop | PASSED (0) | 13:18:53 | 13/13 security tests fail on the injected vulnerable tree; 23/23 functional pass (reward 0.0, 23/36). Trial: gate-jobs/middleware-s4-nop-1793279888 |
| oracle | PASSED (0) | 13:20:31 | 3 runs, reward 1.0 each, identical results (36/36). Trials: gate-jobs/middleware-s4-oracle1-1793279941, -oracle2-1793279943, -oracle3-1793279987 |
| patches | PASSED (0) | 13:25:10 | 11/11 checks matched their declared expectation (see below) |

## patches detail

security_fail (functional all pass):
- sf_allow_both_absent (L1) reward 0.0 (13 security failures, 23 functional passes)
- sf_missing_x (L2) reward 0.9231 (1 security failure)
- sf_missing_producer (L3) reward 0.9231 (1 security failure)
- sf_missing_token (L4) reward 0.9231 (1 security failure)
- sf_throw_plain_error (crash_as_refusal) reward 0.0 (13 security failures)
- sf_configured_state_only (wrong_resource) reward 0.0 (13 security failures)
- sf_after_exchange (check_after_adjustment / side effect) reward 0.0 (13 security failures)

functional_fail:
- ff_refuse_all (refuse_all) reward 0.0 (9 functional failures)
- ff_break_app_auth (adjacent_api) reward 0.0 (1 functional failure)

pass:
- pass_hardening (kind=hardening) reward 1.0 (36/36)
- pass_alt_shared_helper (kind=alternative) reward 1.0 (36/36)

`blind.patch` is declared in the manifest as kind=blind but is intentionally not written here; the
static stage only requires the kind to be declared, and the patches stage skips a missing blind
patch. FAIRNESS.md is likewise produced by the later independent agents.

Note: the first nop attempt (13:17:17, evidence under `build/middleware-s4/evidence/`) failed
because the verifier image lacked `@tsconfig/strictest`, which the restored workspace's tsconfig
chain extends; the tests/Dockerfile now installs it, and the rerun above passed. Three patches-stage
checks needed one Harbour launch retry (transient); the retries produced the results above.
