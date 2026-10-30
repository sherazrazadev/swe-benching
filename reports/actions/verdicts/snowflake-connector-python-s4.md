# `snowflake-connector-python-s4`: REJECTED

**Why:** dropped by the owner: the only test every run fails (test_probe_session_refuses_certificate_for_another_name) targets the deliberately unvalidated diagnostic probe, which the instruction (request-centred) does not put in scope, and its paired functional test penalises the stronger correct fix; removing them leaves every run at 1.0, so the task does not discriminate.

- Verify the TLS server identity on every connection the Snowflake Python connector opens, without weakening the caller's TLS settings.
- CWE-297, Python, https://github.com/snowflakedb/snowflake-connector-python
- Batch 25, [run 41020966300](https://github.com/sherazrazadev/swe-benching/actions/runs/41020966300) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/41020966300)
- Trials: DeepSeek 0.8333 0.8333 0.8333 / MiMo 0.8333 0.8333 0.8333

## Fairness review: NOT_READY

Owner decision: **DROP** ([HUMAN-DECISION.md](../checks/snowflake-connector-python-s4/HUMAN-DECISION.md))

Full review: [snowflake-connector-python-s4-FAIRNESS.md](snowflake-connector-python-s4-FAIRNESS.md)

## Audits of the failing runs (0/6 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| [deepseek](../audits/snowflake-connector-python-s4-deepseek-r1-20261030-095316-n001/POSTMORTEM.md) | 0.8333 | None | not audited () |  |
| [deepseek](../audits/snowflake-connector-python-s4-deepseek-r2-20261030-133527-n001/POSTMORTEM.md) | 0.8333 | None | not audited () |  |
| [deepseek](../audits/snowflake-connector-python-s4-deepseek-r3-20261030-133427-n001/POSTMORTEM.md) | 0.8333 | None | not audited () |  |
| [mimo](../audits/snowflake-connector-python-s4-mimo-r1-20261030-101838-n001/POSTMORTEM.md) | 0.8333 | None | not audited () |  |
| [mimo](../audits/snowflake-connector-python-s4-mimo-r2-20261030-133411-n001/POSTMORTEM.md) | 0.8333 | None | not audited () |  |
| [mimo](../audits/snowflake-connector-python-s4-mimo-r3-20261030-133416-n001/POSTMORTEM.md) | 0.8333 | None | not audited () |  |
