DECISION: DROP
DATE: 2026-10-30
WHY: the only test every run fails (test_probe_session_refuses_certificate_for_another_name) targets the deliberately unvalidated diagnostic probe, which the instruction (request-centred) does not put in scope, and its paired functional test penalises the stronger correct fix; removing them leaves every run at 1.0, so the task does not discriminate.

Delegated owner decision after a fairness check (2026-10-30).
