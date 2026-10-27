# Human decision: avideo-s3

DECISION: DROP
DATE: 2026-10-27
BY: project owner (decision delegated to Claude on 2026-10-27)
SOURCE: reports/actions/checks/avideo-s3/FAIRNESS.md and the audits in reports/actions/audits/

WHY: Unfair as built. In 4 of 6 runs (DeepSeek runs 1-3 and MiMo run 2) the model passed all 7 security tests and failed only functional tests that sign notifications with the raw configured key, while the pinned verifier hex-decodes it; the instruction never states the convention (build notes: deliberate trap ff-hexkey). Under a fair test both models would have solved it, so the task is rejected rather than repaired.
